"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import { ColetaCobrarPixBar } from "@/components/coletas/ColetaCobrarPixBar";
import { CompartilharComprovanteLinkActions } from "@/components/comprovantes/CompartilharComprovanteLinkActions";
import {
  abrirImpressaoRelatorioTexto,
  type RelatorioColetaData,
} from "@/lib/nichos/cassino/relatorio";
import { snapshotFromRelatorioColetaData } from "@/lib/comprovantes/from-relatorio-nicho";
import { resolverFotosNoRelatorio } from "@/lib/comprovantes/previa-relatorio";
import type { HistoricoCassinoPayload } from "@/components/comprovantes/HistoricoVisitaCassinoPublicView";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";
import { formatCurrency } from "@/lib/utils";

interface PreviaRelatorioPanelProps {
  data: RelatorioColetaData;
  disabled?: boolean;
  chavePix?: string | null;
}

function historicoPayloadFromRelatorio(
  data: RelatorioColetaData
): HistoricoCassinoPayload {
  const c = data.calculo;
  return {
    pontoNome: data.pontoNome,
    empresaNome: data.empresaNome,
    dataIso:
      data.data instanceof Date ? data.data.toISOString() : String(data.data),
    comissaoPercentual: data.comissaoPercentual,
    saldoNegativo: c.saldoNegativo === true,
    totalLucroCentavos: c.totalLucroCentavos,
    calculo: c,
    adiantamento: data.adiantamento,
    maquinas: data.maquinas.map((m) => ({
      nome: m.nome,
      entradaAnterior: m.entradaAnterior,
      saidaAnterior: m.saidaAnterior,
      entradaAtual: m.entradaAtual,
      saidaAtual: m.saidaAtual,
      entradaPeriodo: m.entradaAtual - m.entradaAnterior,
      saidaPeriodo: m.saidaAtual - m.saidaAnterior,
      lucroCentavos: m.lucroCentavos,
      fotoUrl: m.fotoUrl ?? null,
    })),
  };
}

/**
 * Ações na coleta (antes de finalizar): WhatsApp, Compartilhar, Imprimir, Cobrar.
 * O link abre o mesmo layout do histórico de coleta.
 */
export function PreviaRelatorioPanel({
  data,
  disabled,
  chavePix = null,
}: PreviaRelatorioPanelProps) {
  const c = data.calculo;
  const valorCobrar = c.saldoNegativo
    ? 0
    : c.restanteReais > 0.009
      ? c.restanteReais
      : Math.max(0, c.valorOperacaoEfetivoReais ?? c.valorOperacaoReais ?? 0);

  const snapshotBase = useMemo(
    () =>
      snapshotFromRelatorioColetaData(
        { ...data, previa: false },
        { previa: false, chavePix }
      ),
    [data, chavePix]
  );

  async function prepareSnapshot(): Promise<ComprovanteSnapshot> {
    const payload = await resolverFotosNoRelatorio(
      historicoPayloadFromRelatorio(data) as unknown as Record<string, unknown>
    );
    return {
      ...snapshotBase,
      previa: false,
      layout: "historico",
      nichoModulo: "cassino",
      relatorio: payload as unknown as Record<string, unknown>,
    };
  }

  function handlePrint() {
    const ok = abrirImpressaoRelatorioTexto({ ...data, previa: false });
    if (!ok) {
      window.alert("Permita pop-ups neste site para imprimir.");
    }
  }

  return (
    <div className="space-y-3">
      <ColetaCobrarPixBar
        embedded
        whatsapp={data.pontoWhatsapp}
        chavePix={chavePix}
        nomeOperacao={data.empresaNome}
        pontoNome={data.pontoNome}
        nichoLabel="Cassino"
        valorAPagar={valorCobrar}
        disabled={disabled}
        linhasResumo={[
          `Operação: ${formatCurrency(c.valorOperacaoEfetivoReais ?? c.valorOperacaoReais)}`,
          ...(c.restanteReais > 0.009
            ? [`Pendente: ${formatCurrency(c.restanteReais)}`]
            : []),
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <CompartilharComprovanteLinkActions
          snapshot={snapshotBase}
          prepareSnapshot={prepareSnapshot}
          telefone={data.pontoWhatsapp}
          disabled={disabled}
          whatsappLabel="WhatsApp"
          shareLabel="Compartilhar"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
      </div>
    </div>
  );
}
