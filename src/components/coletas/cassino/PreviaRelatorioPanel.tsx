"use client";

import { useMemo } from "react";
import { ColetaCobrarPixBar } from "@/components/coletas/ColetaCobrarPixBar";
import { ImprimirRelatorioColetaButton } from "@/components/coletas/ImprimirRelatorioColetaButton";
import { CompartilharComprovanteLinkActions } from "@/components/comprovantes/CompartilharComprovanteLinkActions";
import {
  montarImpressaoOptsCassino,
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

  function getImpressaoOpts() {
    return montarImpressaoOptsCassino({ ...data, previa: false });
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
        <ImprimirRelatorioColetaButton disabled={disabled} getImpressaoOpts={getImpressaoOpts} />
      </div>
    </div>
  );
}
