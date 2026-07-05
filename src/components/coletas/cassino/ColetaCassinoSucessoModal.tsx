"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Download, CheckCircle, Loader2, X } from "lucide-react";
import { RelatorioColetaView } from "./RelatorioColetaView";
import { captureElementAsPng } from "@/lib/nichos/cassino/capture-relatorio";
import {
  buildRelatorioMensagemWhatsApp,
  downloadBlob,
  whatsAppUrl,
  type RelatorioColetaData,
} from "@/lib/nichos/cassino/relatorio";
import { uploadRelatorioImagem } from "@/lib/storage/coleta-fotos";
import { createClient } from "@/lib/supabase/client";

interface ColetaCassinoSucessoModalProps {
  open: boolean;
  data: RelatorioColetaData;
  visitaId: string;
  empresaId: string;
  pontoId: string;
  onClose: () => void;
}

export function ColetaCassinoSucessoModal({
  open,
  data,
  visitaId,
  empresaId,
  pontoId,
  onClose,
}: ColetaCassinoSucessoModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [relatorioUrl, setRelatorioUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

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

  const mensagem = buildRelatorioMensagemWhatsApp(data);
  const waLink = whatsAppUrl(data.pontoWhatsapp, mensagem);

  async function handleWhatsApp() {
    let blob: Blob | null = null;
    if (reportRef.current) {
      blob = await captureElementAsPng(reportRef.current).catch(() => null);
    }
    if (blob) {
      downloadBlob(blob, `relatorio-${visitaId.slice(0, 8)}.png`);
    }
    window.open(waLink, "_blank", "noopener,noreferrer");
  }

  async function handleDownload() {
    if (reportRef.current) {
      const blob = await captureElementAsPng(reportRef.current);
      downloadBlob(blob, `relatorio-${pontoId.slice(0, 8)}.png`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md glass-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">Coleta registrada!</h2>
              <p className="text-sm text-slate-400">Relatório gerado com sucesso</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {gerando && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando relatório...
          </div>
        )}

        {relatorioUrl && (
          <p className="text-xs text-green-400/80 break-all">Relatório salvo no storage</p>
        )}

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-500"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar WhatsApp
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-slate-600 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Salvar relatório (PNG)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary-neon py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
          >
            Concluir
          </button>
        </div>

        {/* Relatório off-screen para captura */}
        <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden>
          <RelatorioColetaView ref={reportRef} data={data} />
        </div>
      </div>
    </div>
  );
}
