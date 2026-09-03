"use client";

import {
  cn,
  formatCurrency,
  formatMoneyInput,
  formatMoneyInputOnBlur,
} from "@/lib/utils";
import { coletaFieldClass } from "./coleta-form-styles";

export type ColetaRecebimentoStatus = {
  valorPago: number;
  saldoPendente?: number;
  haver?: number;
  quitado?: boolean;
  /** Quanto do pagamento foi para a visita de hoje */
  aplicadoVisita?: number;
  /** Quanto do pagamento foi para quitar dívida anterior */
  dividaAbatida?: number;
  /** Quanto ainda resta da dívida anterior após o abatimento */
  dividaRestante?: number;
  /** Texto livre, ex.: "Dívida anterior abatida neste pagamento." */
  mensagem?: string;
};

export function ColetaRecebimentoFields({
  desconto,
  pix,
  dinheiro,
  onDescontoChange,
  onPixChange,
  onDinheiroChange,
  hint,
  status,
  className,
  somenteDesconto = false,
}: {
  desconto: string;
  pix: string;
  dinheiro: string;
  onDescontoChange: (value: string) => void;
  onPixChange: (value: string) => void;
  onDinheiroChange: (value: string) => void;
  hint?: string;
  status?: ColetaRecebimentoStatus | null;
  className?: string;
  /** Na visita multi-nicho: desconto da operação fica no nicho; pix/dinheiro só no Cobrar. */
  somenteDesconto?: boolean;
}) {
  return (
    <div className={cn("border-t border-slate-800 pt-4 space-y-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-at-muted">
        {somenteDesconto ? "Desconto da operação" : "Recebimento"}
      </p>

      <div className="space-y-1.5">
        <label className="block text-xs text-at-muted">Desconto (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={desconto}
          onChange={(e) => onDescontoChange(e.target.value)}
          className={coletaFieldClass()}
          placeholder="0,00"
        />
      </div>

      {!somenteDesconto && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="block text-xs text-at-muted">Dinheiro (R$)</label>
            <input
              inputMode="numeric"
              value={dinheiro}
              onChange={(e) => onDinheiroChange(formatMoneyInput(e.target.value))}
              onBlur={(e) => onDinheiroChange(formatMoneyInputOnBlur(e.target.value))}
              className={coletaFieldClass()}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-at-muted">Pix (R$)</label>
            <input
              inputMode="numeric"
              value={pix}
              onChange={(e) => onPixChange(formatMoneyInput(e.target.value))}
              onBlur={(e) => onPixChange(formatMoneyInputOnBlur(e.target.value))}
              className={coletaFieldClass()}
              placeholder="0,00"
            />
          </div>
        </div>
      )}

      {hint && <p className="text-[11px] text-at-muted">{hint}</p>}

      {!somenteDesconto && status && status.valorPago > 0.009 && (
        <div
          className={cn(
            "rounded-lg px-3 py-2.5 text-xs space-y-1.5",
            status.quitado
              ? "border border-green-500/30 bg-green-500/5"
              : "border border-amber-500/30 bg-amber-500/5"
          )}
        >
          <div className="flex justify-between gap-3">
            <span className="text-at-muted">Pago hoje</span>
            <span className="font-semibold text-green-400 tabular-nums">
              {formatCurrency(status.valorPago)}
            </span>
          </div>
          {(status.aplicadoVisita ?? 0) > 0.009 && (
            <div className="flex justify-between gap-3">
              <span className="text-at-muted">Na visita de hoje</span>
              <span className="font-medium text-at-primary/90 tabular-nums">
                {formatCurrency(status.aplicadoVisita!)}
              </span>
            </div>
          )}
          {(status.dividaAbatida ?? 0) > 0.009 && (
            <div className="flex justify-between gap-3">
              <span className="text-emerald-300">
                {(status.dividaRestante ?? 0) > 0.009
                  ? "Dívida abatida (parcial)"
                  : "Dívida abatida (total)"}
              </span>
              <span className="font-semibold text-emerald-400 tabular-nums">
                {formatCurrency(status.dividaAbatida!)}
              </span>
            </div>
          )}
          {(status.dividaRestante ?? 0) > 0.009 && (
            <div className="flex justify-between gap-3">
              <span className="text-amber-300">Ainda deve (dívida antiga)</span>
              <span className="font-bold text-amber-400 tabular-nums">
                {formatCurrency(status.dividaRestante!)}
              </span>
            </div>
          )}
          {(() => {
            const faltaVisita = Math.max(
              0,
              (status.saldoPendente ?? 0) - (status.dividaRestante ?? 0)
            );
            if (faltaVisita > 0.009) {
              return (
                <div className="flex justify-between gap-3">
                  <span className="text-amber-300">Ainda deve (visita)</span>
                  <span className="font-bold text-amber-400 tabular-nums">
                    {formatCurrency(faltaVisita)}
                  </span>
                </div>
              );
            }
            if ((status.haver ?? 0) > 0.009) {
              return (
                <div className="flex justify-between gap-3">
                  <span className="text-cyan-300">Haver (sobrou do pagamento)</span>
                  <span className="font-bold text-cyan-400 tabular-nums">
                    + {formatCurrency(status.haver!)}
                  </span>
                </div>
              );
            }
            if (
              (status.saldoPendente ?? 0) <= 0.009 &&
              (status.dividaRestante ?? 0) <= 0.009 &&
              status.quitado
            ) {
              return <p className="text-green-400">Quitado</p>;
            }
            return null;
          })()}
          {status.mensagem && (
            <p
              className={cn(
                "pt-1 text-[11px] leading-relaxed",
                (status.dividaRestante ?? 0) > 0.009
                  ? "text-amber-300/95"
                  : "text-emerald-300/90"
              )}
            >
              {status.mensagem}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
