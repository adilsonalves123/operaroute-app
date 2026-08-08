"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { criarLinkComprovante } from "@/lib/comprovantes/client";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";
import {
  compartilharLinkRelatorio,
  compartilharMidiaRelatorio,
  mensagemCompartilhar,
} from "@/lib/relatorios/compartilhar";

/** Botão de compartilhar relatório na tela da visita / histórico. */
export function CompartilharRelatorioColetaButton({
  visitaId,
  pontoNome,
  relatorioUrl,
  snapshot,
  className,
}: {
  visitaId: string;
  pontoNome: string;
  relatorioUrl?: string | null;
  /** Se informado, gera o link com o mesmo modelo da tela pública. */
  snapshot?: ComprovanteSnapshot | null;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setFeedback(null);
    try {
      try {
        const { url, mensagem } = await criarLinkComprovante({
          visita_id: visitaId,
          previa: false,
          nome_operacao: snapshot?.empresaNome,
          chave_pix: snapshot?.chavePix,
          ...(snapshot ? { snapshot } : {}),
        });
        const resultado = await compartilharLinkRelatorio({
          url,
          titulo: `Comprovante — ${pontoNome}`,
          texto: mensagem,
        });
        const msg = mensagemCompartilhar(resultado);
        if (msg) setFeedback(msg);
        return;
      } catch {
        /* fallback imagem */
      }

      if (relatorioUrl) {
        const resultado = await compartilharMidiaRelatorio({
          url: relatorioUrl,
          titulo: `Relatório — ${pontoNome}`,
          texto: `Relatório de coleta · ${pontoNome}`,
          fileName: `relatorio-${pontoNome.slice(0, 24)}.png`,
        });
        const msg = mensagemCompartilhar(resultado);
        if (msg) setFeedback(msg);
        return;
      }

      setFeedback("Não foi possível gerar o link do comprovante.");
    } finally {
      setLoading(false);
      window.setTimeout(() => setFeedback(null), 2500);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleClick()}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        }
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        Compartilhar
      </button>
      {feedback && <p className="text-[11px] text-emerald-400/90">{feedback}</p>}
    </div>
  );
}
