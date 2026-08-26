"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Share2 } from "lucide-react";
import { PeriodoAnaliseSelector } from "@/components/analise/PeriodoAnaliseSelector";
import {
  type PeriodoAnalisePreset,
  type PeriodoAnaliseRange,
} from "@/lib/analise/periodo-analise";
import { whatsAppUrlRota } from "@/lib/rotas/whatsapp-rota";
import { formatCurrency } from "@/lib/utils";

type Linha = {
  nicho: string;
  label: string;
  valor: number;
};

type Props = {
  pontoId: string;
  pontoNome: string;
  whatsapp?: string | null;
  preset: PeriodoAnalisePreset;
  label: string;
  inicioISO: string;
  fimISO: string;
  total: number;
  porNicho: Linha[];
};

function montarTextoComissao(opts: {
  pontoNome: string;
  label: string;
  total: number;
  porNicho: Linha[];
}): string {
  const linhas = [
    `*Comissão do ponto — ${opts.pontoNome}*`,
    `Período: ${opts.label}`,
    "",
    `Total: *${formatCurrency(opts.total)}*`,
  ];

  if (opts.porNicho.length > 1) {
    linhas.push("");
    for (const l of opts.porNicho) {
      linhas.push(`• ${l.label}: ${formatCurrency(l.valor)}`);
    }
  }

  linhas.push("", "Via OperaRoute");
  return linhas.join("\n");
}

/** Comissão que o ponto ganhou no período — recolhível e compartilhável. */
export function PontoComissaoPeriodo({
  pontoId,
  pontoNome,
  whatsapp,
  preset,
  label,
  inicioISO,
  fimISO,
  total,
  porNicho,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const periodo: PeriodoAnaliseRange = {
    preset,
    label,
    inicioISO,
    fimISO,
    inicio: new Date(inicioISO),
    fim: new Date(fimISO),
  };

  const texto = montarTextoComissao({ pontoNome, label, total, porNicho });

  async function compartilhar() {
    setFeedback(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `Comissão — ${pontoNome}`,
          text: texto,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        setFeedback("Texto copiado.");
        return;
      }
      setFeedback("Não foi possível compartilhar neste aparelho.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFeedback("Não foi possível compartilhar.");
    }
  }

  function enviarWhatsApp() {
    window.open(whatsAppUrlRota(whatsapp, texto), "_blank", "noopener,noreferrer");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04]">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-emerald-500/[0.06]"
      >
        <div className="min-w-0">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400/90">
            Comissão do ponto
          </h2>
          <p className="mt-1 text-[15px] font-semibold tabular-nums tracking-tight text-emerald-300">
            {formatCurrency(total)}
          </p>
          {!aberto ? (
            <p className="mt-0.5 text-[12px] text-slate-500">
              {label} · toque para expandir
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-slate-500">{label}</p>
          )}
        </div>
        {aberto ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>

      {aberto ? (
        <div className="space-y-4 border-t border-emerald-500/15 px-4 pb-4 pt-3">
          <PeriodoAnaliseSelector
            atual={periodo}
            basePath={`/pontos/${pontoId}`}
            variante="dashboard"
          />

          {porNicho.length > 1 ? (
            <ul className="space-y-2">
              {porNicho.map((linha) => (
                <li
                  key={linha.nicho}
                  className="flex items-center justify-between gap-3 text-[13px]"
                >
                  <span className="text-slate-400">{linha.label}</span>
                  <span className="font-medium text-slate-200 tabular-nums">
                    {formatCurrency(linha.valor)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {total < 0.0001 ? (
            <p className="text-[13px] text-slate-500">
              Nenhuma comissão lançada neste período.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enviarWhatsApp}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-[13px] font-medium text-emerald-200 transition hover:bg-emerald-500/15"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void compartilhar()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.08]"
            >
              <Share2 className="h-3.5 w-3.5" />
              Compartilhar
            </button>
          </div>

          {feedback ? <p className="text-[12px] text-slate-400">{feedback}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
