"use client";

import { MessageCircle, Download, CheckCircle, Loader2, Share2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RelatorioColetaView } from "./RelatorioColetaView";
import { captureElementAsPng } from "@/lib/nichos/cassino/capture-relatorio";
import {
  downloadBlob,
  type RelatorioColetaData,
} from "@/lib/nichos/cassino/relatorio";
import { uploadRelatorioImagem } from "@/lib/storage/coleta-fotos";
import { createClient } from "@/lib/supabase/client";
import {
  abrirWhatsAppComComprovante,
  criarLinkComprovante,
} from "@/lib/comprovantes/client";
import { snapshotFromRelatorioColetaData } from "@/lib/comprovantes/from-relatorio-nicho";
import {
  compartilharBlobRelatorio,
  compartilharLinkRelatorio,
  mensagemCompartilhar,
} from "@/lib/relatorios/compartilhar";

interface ColetaCassinoSucessoModalProps {
  open: boolean;
  data: RelatorioColetaData;
  visitaId: string;
  empresaId: string;
  pontoId: string;
  /** Se a coleta foi feita dentro de uma visita ao ponto, preferir este id no link. */
  visitaPontoId?: string | null;
  onClose: () => void;
}

export function ColetaCassinoSucessoModal({
  open,
  data,
  visitaId,
  empresaId,
  pontoId,
  visitaPontoId = null,
  onClose,
}: ColetaCassinoSucessoModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [relatorioUrl, setRelatorioUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState("");

  const gerarRelatorio = useCallback(async () => {
    if (!reportRef.current) return null;
    setGerando(true);
    setErro("");
    try {
      const blob = await captureElementAsPng(reportRef.current);
      const supabase = createClient();
      const url = await uploadRelatorioImagem(supabase, empresaId, visitaId, blob, false);
      setRelatorioUrl(url);

      await supabase.from("relatorios_coleta").insert({
        empresa_id: empresaId,
        visita_id: visitaId,
        ponto_id: pontoId,
        foto_url: url,
        previa: false,
      });

      await supabase.from("visitas").update({ relatorio_url: url }).eq("id", visitaId);

      return blob;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar relatório");
      return null;
    } finally {
      setGerando(false);
    }
  }, [empresaId, visitaId, pontoId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      gerarRelatorio();
    }, 900);
    return () => clearTimeout(t);
  }, [open, gerarRelatorio]);

  if (!open) return null;

  const snapshot = snapshotFromRelatorioColetaData(data, { previa: false });

  async function handleWhatsApp() {
    setErro("");
    setEnviando(true);
    try {
      // Sempre manda snapshot da tela + ids — a API usa o que conseguir.
      await abrirWhatsAppComComprovante({
        telefone: data.pontoWhatsapp,
        input: {
          ...(visitaPontoId ? { visita_ponto_id: visitaPontoId } : {}),
          ...(visitaId ? { visita_id: visitaId } : {}),
          previa: false,
          nome_operacao: data.empresaNome,
          snapshot,
        },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar link do comprovante.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleCompartilhar() {
    setErro("");
    setFeedback("");
    setCompartilhando(true);
    try {
      try {
        const { url, mensagem } = await criarLinkComprovante({
          ...(visitaPontoId ? { visita_ponto_id: visitaPontoId } : {}),
          ...(visitaId ? { visita_id: visitaId } : {}),
          previa: false,
          nome_operacao: data.empresaNome,
          snapshot,
        });
        const resultado = await compartilharLinkRelatorio({
          url,
          titulo: `Comprovante — ${data.pontoNome}`,
          texto: mensagem,
        });
        const msg = mensagemCompartilhar(resultado);
        if (msg) setFeedback(msg);
        return;
      } catch {
        /* fallback: compartilha PNG da tela */
      }

      if (reportRef.current) {
        const blob = await captureElementAsPng(reportRef.current);
        const resultado = await compartilharBlobRelatorio({
          blob,
          titulo: `Comprovante — ${data.pontoNome}`,
          texto: `Comprovante de coleta · ${data.pontoNome}`,
          fileName: `relatorio-${pontoId.slice(0, 8)}.png`,
        });
        const msg = mensagemCompartilhar(resultado);
        if (msg) setFeedback(msg);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao compartilhar.");
    } finally {
      setCompartilhando(false);
    }
  }

  async function handleDownload() {
    if (reportRef.current) {
      const blob = await captureElementAsPng(reportRef.current);
      downloadBlob(blob, `relatorio-${pontoId.slice(0, 8)}.png`);
    }
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md glass-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">Coleta registrada!</h2>
              <p className="text-sm text-slate-400">
                Compartilhe o comprovante ou envie no WhatsApp
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {gerando && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando cópia do relatório...
          </div>
        )}

        {relatorioUrl && (
          <p className="text-xs text-green-400/80">Cópia salva no histórico</p>
        )}

        {erro && <p className="text-sm text-red-400">{erro}</p>}
        {feedback && <p className="text-sm text-emerald-400/90">{feedback}</p>}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleCompartilhar()}
            disabled={compartilhando || enviando}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-cyan-500/40 bg-cyan-500/15 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {compartilhando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Compartilhar
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={enviando || compartilhando}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Enviar link no WhatsApp
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-slate-600 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Salvar PNG (opcional)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary-neon py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
          >
            Concluir
          </button>
        </div>

        <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden>
          <RelatorioColetaView ref={reportRef} data={data} />
        </div>
      </div>
    </div>
  );
}
