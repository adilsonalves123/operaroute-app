"use client";

import { useRef, useState } from "react";
import { MessageCircle, Download, Loader2 } from "lucide-react";
import { RelatorioColetaView } from "./RelatorioColetaView";
import { captureElementAsPng } from "@/lib/nichos/cassino/capture-relatorio";
import {
  buildRelatorioMensagemWhatsApp,
  downloadBlob,
  whatsAppUrl,
  type RelatorioColetaData,
} from "@/lib/nichos/cassino/relatorio";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

interface PreviaRelatorioPanelProps {
  data: RelatorioColetaData;
  disabled?: boolean;
}

export function PreviaRelatorioPanel({ data, disabled }: PreviaRelatorioPanelProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  async function handlePreviaWhatsApp() {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      const blob = await captureElementAsPng(reportRef.current);
      downloadBlob(blob, `previa-coleta-${Date.now()}.png`);
      const msg = buildRelatorioMensagemWhatsApp(data);
      window.open(whatsAppUrl(data.pontoWhatsapp, msg), "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      const blob = await captureElementAsPng(reportRef.current);
      downloadBlob(blob, `previa-coleta-${Date.now()}.png`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <div className="glass-card p-4 space-y-3 border border-amber-500/20">
      <p className="text-sm font-medium text-amber-300">Prévia para o cliente</p>
      <p className="text-xs text-slate-500">
        Gera o relatório e abre o WhatsApp — nada é salvo no banco.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={handlePreviaWhatsApp}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          Enviar prévia ao cliente
        </button>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Baixar PNG
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 p-2 bg-slate-950/50">
        <RelatorioColetaView ref={reportRef} data={{ ...data, previa: true }} />
      </div>
    </div>

    <LoadingOverlay
      show={loading}
      messages={[
        "Gerando relatório...",
        "Preparando imagem...",
        "Quase lá...",
      ]}
    />
    </>
  );
}
