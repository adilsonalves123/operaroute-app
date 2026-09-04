"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Share2 } from "lucide-react";
import {
  abrirWhatsAppComComprovante,
  criarLinkComprovante,
  type CriarComprovanteClientInput,
} from "@/lib/comprovantes/client";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";
import {
  compartilharLinkRelatorio,
  mensagemCompartilhar,
} from "@/lib/relatorios/compartilhar";
import { cn } from "@/lib/utils";
import { coletaBtnOutlineClass } from "@/components/coletas/layout/coleta-form-styles";

type Props = {
  snapshot: ComprovanteSnapshot;
  /** Monta o snapshot na hora (ex.: sobe fotos da prévia). */
  prepareSnapshot?: () => Promise<ComprovanteSnapshot>;
  telefone?: string | null;
  visitaId?: string | null;
  visitaPontoId?: string | null;
  disabled?: boolean;
  className?: string;
  /** Só WhatsApp, só compartilhar, ou ambos. */
  mode?: "both" | "whatsapp" | "share";
  whatsappLabel?: string;
  shareLabel?: string;
};

function buildInput(
  snapshot: ComprovanteSnapshot,
  visitaId?: string | null,
  visitaPontoId?: string | null
): CriarComprovanteClientInput {
  return {
    ...(visitaPontoId ? { visita_ponto_id: visitaPontoId } : {}),
    ...(visitaId ? { visita_id: visitaId } : {}),
    previa: snapshot.previa === true,
    nome_operacao: snapshot.empresaNome,
    chave_pix: snapshot.chavePix,
    snapshot,
  };
}

/** WhatsApp + Compartilhar gerando o link mágico `/c/[token]`. */
export function CompartilharComprovanteLinkActions({
  snapshot,
  prepareSnapshot,
  telefone,
  visitaId,
  visitaPontoId,
  disabled,
  className,
  mode = "both",
  whatsappLabel = "Enviar link no WhatsApp",
  shareLabel = "Compartilhar",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function resolveSnapshot() {
    return prepareSnapshot ? prepareSnapshot() : snapshot;
  }

  async function handleWhatsApp() {
    setLoading(true);
    setErro(null);
    try {
      const snap = await resolveSnapshot();
      await abrirWhatsAppComComprovante({
        telefone,
        input: buildInput(snap, visitaId, visitaPontoId),
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    setLoading(true);
    setErro(null);
    setFeedback(null);
    try {
      const snap = await resolveSnapshot();
      const { url, mensagem } = await criarLinkComprovante(
        buildInput(snap, visitaId, visitaPontoId)
      );
      const resultado = await compartilharLinkRelatorio({
        url,
        titulo: `${snap.previa ? "Prévia" : "Comprovante"} — ${snap.pontoNome}`,
        texto: mensagem,
      });
      const msg = mensagemCompartilhar(resultado);
      if (msg) {
        setFeedback(msg);
        window.setTimeout(() => setFeedback(null), 2500);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar link.");
    } finally {
      setLoading(false);
    }
  }

  const showWa = mode === "both" || mode === "whatsapp";
  const showShare = mode === "both" || mode === "share";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap gap-2">
        {showWa && (
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => void handleWhatsApp()}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {whatsappLabel}
          </button>
        )}
        {showShare && (
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => void handleShare()}
            className={coletaBtnOutlineClass()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {shareLabel}
          </button>
        )}
      </div>
      {feedback && <p className="text-[11px] text-emerald-400/90">{feedback}</p>}
      {erro && <p className="text-[11px] text-red-400/90">{erro}</p>}
    </div>
  );
}
