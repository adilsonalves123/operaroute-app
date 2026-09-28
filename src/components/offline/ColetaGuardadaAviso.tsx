"use client";

import { CloudOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";

type Props = {
  aberto: boolean;
  /** Visita encerrada junto (Receber agora + encerrar) — também vai na fila. */
  comFechamento?: boolean;
  onVoltar: () => void;
};

/** Mostrado quando a coleta foi guardada no celular por falta de sinal. */
export function ColetaGuardadaAviso({ aberto, comFechamento, onVoltar }: Props) {
  const online = useOnline();

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-at bg-at-card p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
            <CloudOff className="h-5 w-5 text-amber-400" />
          </span>
          <h2 className="text-base font-semibold text-at-primary">Coleta guardada no celular</h2>
        </div>
        <div className="mt-3 space-y-2 text-[14px] leading-relaxed text-at-muted">
          <p>
            Sem sinal agora. A coleta ficou salva neste aparelho e vai para o sistema sozinha quando a
            internet voltar{comFechamento ? ", junto com o fechamento da visita" : ""}.{" "}
            <span className="text-at-primary">Não precisa fazer de novo.</span>
          </p>
          <p className="text-[13px] text-at-soft">
            Ela conta no dia de hoje. Se algo mudar no ponto até o envio (dívida, haver, contador), o
            sistema grava com o valor atual e marca para o dono conferir. Não limpe os dados do app até
            o aviso &quot;guardado no celular&quot; sumir.
          </p>
        </div>
        <button
          type="button"
          onClick={onVoltar}
          disabled={!online}
          className="mt-4 w-full rounded-lg border border-at bg-at-card-soft px-4 py-2.5 text-sm font-medium text-at-link transition hover:border-[var(--at-tab-active-border)] disabled:opacity-50"
        >
          {online ? "Voltar" : "Aguardando sinal para sair desta tela…"}
        </button>
      </div>
    </div>
  );
}
