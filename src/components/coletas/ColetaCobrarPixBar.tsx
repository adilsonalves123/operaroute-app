"use client";

import { Banknote } from "lucide-react";
import { whatsAppUrl } from "@/lib/nichos/cassino/relatorio";
import {
  linkWhatsAppCobrancaColetaNicho,
  mensagemCobrancaColetaNicho,
  type CobrancaColetaNichoOpts,
} from "@/lib/coletas/cobranca-whatsapp-nicho";
import {
  coletaBtnPrimaryClass,
  coletaCobrarBoxClass,
} from "@/components/coletas/layout/coleta-form-styles";
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
    <div className={coletaCobrarBoxClass(className)}>
      <div>
        <p className="text-sm font-medium text-at-primary">Cobrar / mandar chave Pix</p>
        <p className="mt-0.5 text-[11px] leading-snug text-at-muted">
          Abre o WhatsApp com o resumo e{" "}
          {chavePix?.trim() ? (
            <>
              a chave Pix{" "}
              <span className="font-mono text-at-link">
                {chavePix.trim().length > 28
                  ? `${chavePix.trim().slice(0, 28)}…`
                  : chavePix.trim()}
              </span>
            </>
          ) : (
            <span className="text-at-link">(cadastre a chave em Configurações)</span>
          )}
          .
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={handleCobrar}
        className={cn(coletaBtnPrimaryClass("w-full"), embedded && "py-2.5")}
      >
        <Banknote className="h-4 w-4" />
        Cobrar {formatCurrency(valorAPagar)}
      </button>
    </div>
  );
}
