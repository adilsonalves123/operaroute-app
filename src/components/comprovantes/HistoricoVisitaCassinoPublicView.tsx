"use client";

import { VisitaPositivaResumo } from "@/components/coletas/cassino/VisitaPositivaResumo";
import { VisitaNegativaResumo } from "@/components/coletas/cassino/VisitaNegativaResumo";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatContador, centesimosToReais } from "@/lib/nichos/cassino";
import { getEquipamentoTipoLabel } from "@/lib/equipamentos";
import type { CalculoVisitaResult } from "@/lib/nichos/cassino/types";
import type { AdiantamentoDetalhe } from "@/lib/nichos/cassino/relatorio";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { ComprovantePublicView } from "@/components/comprovantes/ComprovantePublicView";

export type HistoricoCassinoMaquina = {
  nome: string;
  tipo?: string | null;
  entradaAnterior: number;
  saidaAnterior: number;
  entradaAtual: number;
  saidaAtual: number;
  entradaPeriodo: number;
  saidaPeriodo: number;
  lucroCentavos: number;
  fotoUrl?: string | null;
};

export type HistoricoCassinoPayload = {
  pontoNome: string;
  empresaNome?: string;
  dataIso: string;
  gpsRegistrado?: boolean;
  comissaoPercentual: number;
  saldoNegativo: boolean;
  totalLucroCentavos: number;
  calculo: CalculoVisitaResult;
  adiantamento?: AdiantamentoDetalhe;
  maquinas: HistoricoCassinoMaquina[];
  observacao?: string | null;
};

/**
 * Link público do histórico de coleta cassino —
 * mesmo visual da tela /coletas/visita/[id].
 */
export function HistoricoVisitaCassinoPublicView({
  snapshot,
}: {
  snapshot: ComprovanteSnapshot;
}) {
  const raw = snapshot.relatorio as HistoricoCassinoPayload | undefined;
  if (!raw?.calculo || !Array.isArray(raw.maquinas)) {
    return <ComprovantePublicView snapshot={snapshot} />;
  }

  const quitada =
    !raw.saldoNegativo &&
    Number(raw.calculo.restanteReais ?? 0) <= 0.009 &&
    Number(raw.calculo.valorPagoReais ?? 0) > 0.009;
  const pendente =
    !raw.saldoNegativo && Number(raw.calculo.restanteReais ?? 0) > 0.009;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {raw.pontoNome || snapshot.pontoNome}
          </h1>
          {raw.saldoNegativo && <AlertBadge variant="danger">Saldo negativo</AlertBadge>}
          {pendente && <AlertBadge variant="warning">Pagamento pendente</AlertBadge>}
          {quitada && <AlertBadge variant="success">Quitada</AlertBadge>}
        </div>
        <p className="text-sm text-at-muted">
          {formatDateTime(raw.dataIso || snapshot.dataIso)}
        </p>
        {raw.gpsRegistrado && (
          <p className="inline-flex items-center gap-1 text-xs text-at-muted">
            <MapPin className="h-3.5 w-3.5" />
            GPS registrado
          </p>
        )}
      </div>

      {raw.saldoNegativo ? (
        <VisitaNegativaResumo
          calculo={raw.calculo}
          adiantamento={raw.adiantamento}
          totalLucroCentavos={raw.totalLucroCentavos}
        />
      ) : (
        <VisitaPositivaResumo
          calculo={raw.calculo}
          comissaoPercentual={raw.comissaoPercentual}
          totalLucroCentavos={raw.totalLucroCentavos}
          ocultarStaff
        />
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">
          Máquinas{" "}
          <span className="font-normal text-at-muted">({raw.maquinas.length})</span>
        </h2>
        {raw.maquinas.map((m, i) => (
          <div
            key={`${m.nome}-${i}`}
            className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
              <div>
                <p className="font-medium text-white">{m.nome}</p>
                {m.tipo && (
                  <p className="text-xs text-at-muted">
                    {getEquipamentoTipoLabel(m.tipo as never)}
                  </p>
                )}
              </div>
              <p className="text-base font-semibold tabular-nums text-emerald-400">
                {formatCurrency(centesimosToReais(Number(m.lucroCentavos ?? 0)))}
              </p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div className="space-y-1.5 rounded-xl bg-slate-900/70 p-3 text-xs">
                <p className="font-medium text-at-primary/85">Entrada</p>
                <div className="flex justify-between gap-2 text-at-muted">
                  <span>Anterior</span>
                  <span className="tabular-nums">
                    {formatContador(Number(m.entradaAnterior ?? 0))}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-at-muted">
                  <span>Atual</span>
                  <span className="tabular-nums">
                    {formatContador(Number(m.entradaAtual ?? 0))}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-800 pt-1.5 text-emerald-400">
                  <span>Período</span>
                  <span className="tabular-nums font-medium">
                    {formatContador(Number(m.entradaPeriodo ?? 0))}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 rounded-xl bg-slate-900/70 p-3 text-xs">
                <p className="font-medium text-at-primary/85">Saída</p>
                <div className="flex justify-between gap-2 text-at-muted">
                  <span>Anterior</span>
                  <span className="tabular-nums">
                    {formatContador(Number(m.saidaAnterior ?? 0))}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-at-muted">
                  <span>Atual</span>
                  <span className="tabular-nums">
                    {formatContador(Number(m.saidaAtual ?? 0))}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-800 pt-1.5 text-rose-400">
                  <span>Período</span>
                  <span className="tabular-nums font-medium">
                    {formatContador(Number(m.saidaPeriodo ?? 0))}
                  </span>
                </div>
              </div>
            </div>
            {m.fotoUrl && (
              <div className="border-t border-slate-800/80 p-3">
                <ExpandableImage
                  src={m.fotoUrl}
                  alt={`Foto ${m.nome}`}
                  className="max-h-52 rounded-xl"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {raw.observacao && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-at-muted">
            Observação
          </p>
          <p className="mt-1 text-sm text-at-primary/85">{raw.observacao}</p>
        </div>
      )}

      <p className="pt-2 text-center text-[11px] text-at-soft">OperaRout</p>
    </div>
  );
}
