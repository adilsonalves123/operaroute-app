"use client";

import { Banknote } from "lucide-react";
import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import {
  linkWhatsAppCobrancaColetaNicho,
  mensagemCobrancaColetaNicho,
  type CobrancaColetaNichoOpts,
} from "@/lib/coletas/cobranca-whatsapp-nicho";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  whatsapp?: string | null;
  chavePix?: string | null;
  nomeOperacao?: string | null;
  pontoNome: string;
  nichoLabel: string;
  valorAPagar: number;
  linhasResumo?: string[];
  disabled?: boolean;
  className?: string;
  /** Layout compacto (dentro da prévia do painel direito). */
  embedded?: boolean;
};

/** Botão Cobrar / Mandar chave Pix — resumo + chave da operação no WhatsApp. */
export function ColetaCobrarPixBar({
  whatsapp,
  chavePix,
  nomeOperacao,
  pontoNome,
  nichoLabel,
  valorAPagar,
  linhasResumo,
  disabled,
  className,
  embedded,
}: Props) {
  if (valorAPagar <= 0.009) return null;

  const opts: CobrancaColetaNichoOpts = {
    pontoNome,
    nichoLabel,
    valorAPagar,
    linhasResumo,
    chavePix,
    nomeOperacao,
  };

  function handleCobrar() {
    if (!whatsapp?.trim()) {
      window.alert("Cadastre o WhatsApp do ponto para cobrar.");
      return;
    }
    if (!chavePix?.trim()) {
      const seguir = window.confirm(
        "Nenhuma chave Pix cadastrada em Configurações → Dados da operação. Abrir WhatsApp sem a chave?"
      );
      if (!seguir) return;
    }
    const msg = mensagemCobrancaColetaNicho(opts);
    const link =
      linkWhatsAppCobrancaColetaNicho(whatsapp, opts) ?? whatsAppUrl(whatsapp, msg);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-cyan-500/25 bg-cyan-500/[0.05] p-3 space-y-2",
        className
      )}
    >
      <div>
        <p className="text-sm font-medium text-cyan-200">Cobrar / mandar chave Pix</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          Abre o WhatsApp com o resumo e{" "}
          {chavePix?.trim() ? (
            <>
              a chave Pix{" "}
              <span className="font-mono text-cyan-300/90">
                {chavePix.trim().length > 28
                  ? `${chavePix.trim().slice(0, 28)}…`
                  : chavePix.trim()}
              </span>
            </>
          ) : (
            <span className="text-amber-400/90">
              (cadastre a chave em Configurações)
            </span>
          )}
          .
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={handleCobrar}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50",
          embedded && "py-2.5"
        )}
      >
        <Banknote className="h-4 w-4" />
        Cobrar {formatCurrency(valorAPagar)}
      </button>
    </div>
  );
}
