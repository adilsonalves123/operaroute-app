"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import {
  estaEmTrial,
  temPagamentoValido,
  type AcessoAssinaturaInput,
} from "@/lib/assinatura-acesso";
import { champagneLink, ConfigPanelBody } from "@/components/configuracoes/configuracoes-ui";

type Props = {
  acesso: AcessoAssinaturaInput;
  podeCancelar: boolean;
  id?: string;
  className?: string;
  embedded?: boolean;
};

function formatDay(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function CancelarAssinaturaCard({
  acesso,
  podeCancelar,
  id,
  className,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"fim" | "imediato" | null>(null);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const emTrial = estaEmTrial(acesso);
  const pagamentoOk = temPagamentoValido(acesso);

  const vence = acesso.assinatura_vence_em
    ? new Date(acesso.assinatura_vence_em)
    : null;
  const venceFuturo = vence && vence.getTime() > Date.now();
  const venceLabel = formatDay(acesso.assinatura_vence_em ?? null);

  const mostrarCancelamento = podeCancelar && (pagamentoOk || venceFuturo);

  async function cancelar(modo: "fim_periodo" | "imediato") {
    setError("");
    setOkMsg("");

    const msg =
      modo === "imediato"
        ? "Encerrar a assinatura agora? O acesso ao sistema será bloqueado. Seus dados permanecem salvos."
        : venceLabel
          ? `Cancelar a renovação? Você mantém acesso até ${venceLabel} — sem nova cobrança automática.`
          : "Confirmar cancelamento da assinatura?";

    if (!confirm(msg)) return;

    setLoading(modo === "imediato" ? "imediato" : "fim");
    try {
      const res = await fetch("/api/billing/cancelar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível cancelar.");
        return;
      }

      if (modo === "imediato") {
        setOkMsg("Assinatura encerrada. Redirecionando…");
        window.location.assign("/planos");
        return;
      }

      const ate = data.acesso_ate
        ? formatDay(String(data.acesso_ate))
        : venceLabel;
      setOkMsg(
        ate
          ? `Renovação cancelada. Acesso até ${ate}.`
          : "Assinatura cancelada."
      );
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  const inner = (
  <>
      <LoadingOverlay show={loading !== null} message="Processando…" />
      <p className="text-[13px] text-slate-500 leading-relaxed">
        Não há débito automático no cartão. Para parar, cancele a renovação ou
        simplesmente não pague o próximo período.
      </p>

      {emTrial && !pagamentoOk && (
        <p className="mt-3 text-[13px] text-slate-500 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
          No teste grátis, basta <strong className="text-slate-400">não assinar</strong> —
          nenhuma cobrança será feita.
        </p>
      )}

      {mostrarCancelamento && (
        <div className="mt-4 space-y-3">
          {venceFuturo && venceLabel && (
            <p className="text-[12px] text-slate-500">
              Período vigente até{" "}
              <span className="text-[#e8d5b0]">{venceLabel}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {venceFuturo && (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void cancelar("fim_periodo")}
                className="rounded-lg border border-white/12 px-4 py-2.5 text-[12px] font-medium text-slate-300 transition hover:border-[#c4a574]/30 hover:text-[#e8d5b0] disabled:opacity-50"
              >
                {loading === "fim" ? "Processando…" : "Cancelar renovação"}
              </button>
            )}
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => void cancelar("imediato")}
              className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-4 py-2.5 text-[12px] font-medium text-rose-300 transition hover:bg-rose-500/12 disabled:opacity-50"
            >
              {loading === "imediato" ? "Encerrando…" : "Encerrar agora"}
            </button>
          </div>
        </div>
      )}

      {!podeCancelar && (pagamentoOk || venceFuturo) && (
        <p className="mt-3 text-[12px] text-slate-500">
          Solicite ao responsável da operação ou{" "}
          <Link href="/suporte" className={champagneLink}>fale com o suporte</Link>.
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-rose-400 flex items-start gap-2" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {okMsg && (
        <p className="mt-3 text-sm text-emerald-400" role="status">{okMsg}</p>
      )}
  </>
  );

  if (embedded) {
    return (
      <div id={id} className={className}>
        <ConfigPanelBody className="bg-black/15">{inner}</ConfigPanelBody>
      </div>
    );
  }

  return (
    <div id={id} className={className}>
      <div className="glass-card p-6 space-y-4">{inner}</div>
    </div>
  );
}
