"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { parseFetchJson } from "@/lib/http/parse-fetch-json";

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

  /**
   * Antes de Receber e encerrar: avisa se ainda há nichos disponíveis
   * além do que já foi feito (+ o atual, que ainda não entrou no resumo).
   */
  async function confirmarReceberEncerrar(): Promise<boolean> {
    if (!visitaPontoId) return true;
    try {
      const res = await fetch(`/api/visitas-ponto/${visitaPontoId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return true;
      const disponiveis: string[] = Array.isArray(data.nichosDisponiveis)
        ? data.nichosDisponiveis
        : [];
      const feitos = new Set(
        ((data.resumo?.nichos ?? []) as { nicho?: string }[])
          .map((n) => n.nicho)
          .filter(Boolean) as string[]
      );
      // Após salvar este nicho, ainda sobraria pelo menos outro?
      if (disponiveis.length > feitos.size + 1) {
        return window.confirm(
          "Isso encerra a visita agora.\n\nOutros nichos ficam de fora desta cobrança. Deseja continuar?"
        );
      }
    } catch {
      /* segue */
    }
    return true;
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

  return {
    visitaPontoId,
    emVisitaPonto: Boolean(visitaPontoId),
    ensuringVisita: ensuring && !visitaPontoId,
    voltarAposColeta,
    confirmarReceberEncerrar,
    finalizarVisitaAgora,
  };
}
