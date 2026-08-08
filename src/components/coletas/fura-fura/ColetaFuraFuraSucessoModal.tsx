"use client";

import { CheckCircle, X } from "lucide-react";
import { RelatorioFuraFuraView } from "./RelatorioFuraFuraView";
import type { RelatorioFuraFuraData } from "@/lib/nichos/fura-fura/relatorio";
import { snapshotFromRelatorioFuraFura } from "@/lib/comprovantes/from-relatorio-nicho";
import { montarSnapshotRelatorio } from "@/lib/comprovantes/previa-relatorio";
import { CompartilharComprovanteLinkActions } from "@/components/comprovantes/CompartilharComprovanteLinkActions";

type Props = {
  open: boolean;
  data: RelatorioFuraFuraData;
  /** Id da coleta fura-fura (para metadados; o link usa o snapshot). */
  coletaId?: string | null;
  visitaPontoId?: string | null;
  chavePix?: string | null;
  valorACobrar?: number;
  onClose: () => void;
};

/**
 * Mesmo fluxo do cassino após salvar: comprovante + WhatsApp/compartilhar,
 * depois Concluir (volta ao hub da visita ou lista).
 */
export function ColetaFuraFuraSucessoModal({
  open,
  data,
  visitaPontoId = null,
  chavePix = null,
  valorACobrar,
  onClose,
}: Props) {
  if (!open) return null;

  const relatorio = { ...data, previa: false };
  const snapshotBase = snapshotFromRelatorioFuraFura(relatorio, {
    chavePix,
    valorACobrar,
  });

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 shrink-0 text-green-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Coleta registrada!</h2>
              <p className="text-sm text-slate-400">
                Compartilhe o comprovante ou envie no WhatsApp
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
            <RelatorioFuraFuraView data={relatorio} />
          </div>

          <CompartilharComprovanteLinkActions
            snapshot={snapshotBase}
            prepareSnapshot={() =>
              montarSnapshotRelatorio({
                base: snapshotBase,
                nichoModulo: "fura_fura",
                relatorio,
                previa: false,
                layout: "historico",
              })
            }
            telefone={data.pontoWhatsapp}
            visitaPontoId={visitaPontoId}
            whatsappLabel="Enviar link no WhatsApp"
            shareLabel="Compartilhar"
          />

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary-neon py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
