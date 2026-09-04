"use client";

import { useMemo } from "react";
import { ImprimirRelatorioColetaButton } from "@/components/coletas/ImprimirRelatorioColetaButton";
import { formatContador } from "@/lib/nichos/cassino";
import type { RelatorioUrsinhoData } from "@/lib/nichos/ursinho/relatorio";
import { snapshotFromRelatorioUrsinho } from "@/lib/comprovantes/from-relatorio-nicho";
import { montarSnapshotRelatorio } from "@/lib/comprovantes/previa-relatorio";
import { CompartilharComprovanteLinkActions } from "@/components/comprovantes/CompartilharComprovanteLinkActions";
import { abrirImpressaoRelatorioTextoGenerico } from "@/lib/coletas/imprimir-relatorio-texto";
import { ColetaCobrarPixBar } from "@/components/coletas/ColetaCobrarPixBar";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";

/**
 * Ações na coleta: WhatsApp, Compartilhar, Imprimir, Cobrar.
 * Link detalhado = layout histórico (igual cassino), só com entrada.
 */
export function PreviaRelatorioUrsinhoPanel({
  data,
  disabled,
  embedded = false,
  chavePix = null,
  valorACobrar,
}: {
  data: RelatorioUrsinhoData;
  disabled?: boolean;
  embedded?: boolean;
  chavePix?: string | null;
  valorACobrar?: number;
}) {
  const c = data.calculo;
  const valorCobrar =
    valorACobrar != null && valorACobrar >= 0
      ? valorACobrar
      : c.saldoPendente > 0.009
        ? c.saldoPendente
        : Math.max(0, c.valorAReceber - (c.valorPagoRecebido ?? 0));

  const snapshotBase = useMemo(
    () =>
      snapshotFromRelatorioUrsinho(
        { ...data, previa: false },
        { chavePix, valorACobrar: valorCobrar }
      ),
    [data, chavePix, valorCobrar]
  );

  async function prepareSnapshot(): Promise<ComprovanteSnapshot> {
    return montarSnapshotRelatorio({
      base: snapshotBase,
      nichoModulo: "ursinho",
      relatorio: { ...data, previa: false },
      previa: false,
      layout: "historico",
    });
  }

  function handlePrint(formato: "termica" | "a4") {
    return abrirImpressaoRelatorioTextoGenerico({
      titulo: "COLETA — URSINHO",
      empresaNome: data.empresaNome,
      pontoNome: data.pontoNome,
      dataLabel: formatDateTime(data.data),
      blocos: data.maquinas.map((m) => ({
        titulo: m.nome,
        linhas: [
          {
            label: "Entrada",
            valor: `${formatContador(m.entradaAnterior)} → ${formatContador(m.entradaAtual)}`,
          },
          { label: "Operação", valor: formatCurrency(m.lucroReal) },
        ],
      })),
      resumo: [
        { label: "Arrecadação bruta", valor: formatCurrency(c.valorBruto) },
        {
          label: `Comissão (${c.comissaoPercentual}%)`,
          valor: formatCurrency(c.valorComissao),
        },
        ...(c.desconto > 0.009
          ? [{ label: "Desconto", valor: `− ${formatCurrency(c.desconto)}` }]
          : []),
        { label: "A receber", valor: formatCurrency(c.valorAReceber), destaque: true },
        { label: "Lucro real", valor: formatCurrency(c.lucroReal) },
      ],
      formato,
    });
  }

  const content = (
    <div className={cn("space-y-3", embedded && "pt-1")}>
      <ColetaCobrarPixBar
        embedded={embedded}
        whatsapp={data.pontoWhatsapp}
        chavePix={chavePix}
        nomeOperacao={data.empresaNome}
        pontoNome={data.pontoNome}
        nichoLabel="Ursinho"
        valorAPagar={valorCobrar}
        disabled={disabled}
        linhasResumo={[
          `Bruto: ${formatCurrency(c.valorBruto)}`,
          `Comissão: ${formatCurrency(c.valorComissao)}`,
          ...(c.desconto > 0.009 ? [`Desconto: ${formatCurrency(c.desconto)}`] : []),
          `A receber: ${formatCurrency(c.valorAReceber)}`,
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
        <ImprimirRelatorioColetaButton disabled={disabled} onImprimir={handlePrint} />
      </div>

      {disabled && (
        <p className="text-[11px] text-amber-400/90">
          Preencha entrada e foto de todas as máquinas para enviar a prévia.
        </p>
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="glass-card space-y-3 border border-amber-500/20 p-4">
      <p className="text-sm font-medium text-amber-300">Prévia para o cliente</p>
      {content}
    </div>
  );
}
