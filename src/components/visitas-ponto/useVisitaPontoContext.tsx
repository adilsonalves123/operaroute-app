"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseFetchJson } from "@/lib/http/parse-fetch-json";
import { ReceberVisitaDecisaoDialog } from "@/components/visitas-ponto/ReceberVisitaDecisaoDialog";

/** Resultado da escolha após “Receber” neste nicho. */
export type DecisaoReceberVisita = "encerrar" | "continuar" | "abortar";

/**
 * Quando a operação tem 2+ nichos e há um ponto selecionado,
 * entra automaticamente no modo visita (abas no topo + Cobrar no fim).
 */
export function useVisitaPontoContext(pontoIdSelecionado?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visitaPontoId = searchParams.get("visita_ponto")?.trim() ?? "";
  const pontoFromUrl = searchParams.get("ponto")?.trim() ?? "";
  const pontoId = (pontoIdSelecionado || pontoFromUrl).trim();
  const [ensuring, setEnsuring] = useState(false);
  const ensuringFor = useRef<string | null>(null);
  const [decisaoResolve, setDecisaoResolve] = useState<{
    resolve: (v: DecisaoReceberVisita) => void;
  } | null>(null);

  useEffect(() => {
    if (visitaPontoId || !pontoId) return;
    if (ensuringFor.current === pontoId) return;

    let cancelled = false;
    ensuringFor.current = pontoId;
    setEnsuring(true);

    (async () => {
      try {
        const res = await fetch("/api/visitas-ponto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ponto_id: pontoId }),
        });
        const data = await parseFetchJson<{ id?: string; error?: string }>(res);
        if (cancelled) return;

        if (!res.ok || !data.id) {
          ensuringFor.current = null;
          setEnsuring(false);
          return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set("visita_ponto", data.id);
        params.set("ponto", pontoId);
        router.replace(`${pathname}?${params.toString()}`);
      } catch {
        ensuringFor.current = null;
        setEnsuring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visitaPontoId, pontoId, pathname, router, searchParams]);

  useEffect(() => {
    if (visitaPontoId) setEnsuring(false);
  }, [visitaPontoId]);

  function voltarAposColeta(opts?: { visitaJaFinalizada?: boolean }) {
    if (visitaPontoId && opts?.visitaJaFinalizada) {
      // Receber agora: comprovante já foi na coleta — não manda pra tela de Cobrar zerada.
      const ponto = pontoId || searchParams.get("ponto")?.trim();
      router.push(ponto ? `/pontos/${ponto}` : "/coletas");
      router.refresh();
      return;
    }
    if (visitaPontoId) {
      // Continuar: hub da visita — troca de nicho com clareza; Cobrar fica na nav.
      router.push(`/visitas-ponto/${visitaPontoId}`);
    } else {
      router.push("/coletas");
    }
    router.refresh();
  }

  function fecharDecisao(valor: DecisaoReceberVisita) {
    decisaoResolve?.resolve(valor);
    setDecisaoResolve(null);
  }

  /**
   * Antes de Receber: se ainda houver outros nichos (já feitos ou disponíveis),
   * pergunta se encerra a visita ou continua com o restante.
   * Este nicho é sempre cobrado; a diferença é só fechar ou não a visita.
   */
  async function confirmarReceberEncerrar(): Promise<DecisaoReceberVisita> {
    if (!visitaPontoId) return "encerrar";
    try {
      const res = await fetch(`/api/visitas-ponto/${visitaPontoId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return "encerrar";
      const disponiveis: string[] = Array.isArray(data.nichosDisponiveis)
        ? data.nichosDisponiveis
        : [];
      const feitos = new Set(
        ((data.resumo?.nichos ?? []) as { nicho?: string }[])
          .map((n) => n.nicho)
          .filter(Boolean) as string[]
      );
      // Após salvar este nicho, ainda sobraria outro feito ou disponível?
      const jaTemOutrosFeitos = feitos.size > 0;
      const sobraDisponiveis = disponiveis.length > feitos.size + 1;
      if (!jaTemOutrosFeitos && !sobraDisponiveis) {
        return "encerrar";
      }

      return await new Promise<DecisaoReceberVisita>((resolve) => {
        setDecisaoResolve({ resolve });
      });
    } catch {
      return "encerrar";
    }
  }

  async function finalizarVisitaAgora(opts: {
    pix: number;
    dinheiro: number;
    desconto?: number;
    /** Pagamento já aplicado na coleta (receber agora) — só fecha, sem recriar dívida. */
    somenteFechar?: boolean;
  }) {
    if (!visitaPontoId) {
      throw new Error("Visita ao ponto não encontrada.");
    }

    const res = await fetch(`/api/visitas-ponto/${visitaPontoId}/finalizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        // API parseRecebimentoPixDinheiro espera valor_pix / valor_dinheiro
        valor_pix: opts.pix,
        valor_dinheiro: opts.dinheiro,
        pix: opts.pix,
        dinheiro: opts.dinheiro,
        desconto: opts.desconto ?? 0,
        somente_fechar: opts.somenteFechar === true,
        pagamento_ja_aplicado: opts.somenteFechar === true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Erro ao finalizar visita.");
    }

    return data;
  }

  const decisaoDialogEl: ReactNode = decisaoResolve ? (
    <ReceberVisitaDecisaoDialog
      onContinuar={() => fecharDecisao("continuar")}
      onEncerrar={() => fecharDecisao("encerrar")}
      onCancelar={() => fecharDecisao("abortar")}
    />
  ) : null;

  return {
    visitaPontoId,
    emVisitaPonto: Boolean(visitaPontoId),
    ensuringVisita: ensuring && !visitaPontoId,
    voltarAposColeta,
    confirmarReceberEncerrar,
    finalizarVisitaAgora,
    decisaoDialogEl,
  };
}
