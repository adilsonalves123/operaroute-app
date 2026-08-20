"use client";

import { forwardRef } from "react";
import { formatCurrency } from "@/lib/utils";
import type { RelatorioFuraFuraData } from "@/lib/nichos/fura-fura/relatorio";
import type { RelatorioLinhaComprovante } from "@/lib/coletas/relatorio-comprovante-theme";
import { appendLinhasCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";
import {
  RelatorioBadgePrevia,
  RelatorioCabecalho,
  RelatorioCardSoft,
  RelatorioFotoPainel,
  RelatorioResumoFinanceiro,
  RELATORIO_COLORS as colors,
  RELATORIO_SHELL_STYLE,
} from "@/components/coletas/relatorio/RelatorioComprovanteShell";

function buildLinhas(data: RelatorioFuraFuraData): RelatorioLinhaComprovante[] {
  const c = data.calculo;
  const linhas: RelatorioLinhaComprovante[] = [
    { label: "Operação", secao: true },
    { label: "Furos", valor: `${c.quantidadeFuros} × ${formatCurrency(c.precoFuro)}` },
    { label: "Arrecadação bruta", valor: formatCurrency(c.valorBruto) },
    {
      label: `Comissão (${c.comissaoPercentual}%)`,
      valor: formatCurrency(c.valorComissao),
    },
  ];
  if (c.desconto > 0.009) {
    linhas.push({
      label: "Desconto",
      valor: `− ${formatCurrency(c.desconto)}`,
      variant: "discount",
    });
  }
  linhas.push({
    label: "Acerto desta visita",
    secao: true,
    dividerBefore: true,
  });
  linhas.push({
    label: "Operação (desta visita)",
    valor: formatCurrency(c.valorAReceber),
    variant: "highlight",
    destaque: true,
  });
  if (c.custoBrindes > 0.009) {
    linhas.push({ label: "Custo brindes", valor: formatCurrency(c.custoBrindes) });
  }
  linhas.push({ label: "Lucro", valor: formatCurrency(c.lucroReal), variant: "success" });

  const comCobranca = appendLinhasCobrancaDetalhe(linhas, data.cobranca);

  if (c.valorPagoRecebido > 0.009) {
    comCobranca.push({
      label: "Recebido agora",
      valor: formatCurrency(c.valorPagoRecebido),
      variant: "success",
      dividerBefore: true,
    });
  }
  if (c.saldoPendente > 0.009) {
    comCobranca.push({
      label: "Saldo pendente",
      valor: formatCurrency(c.saldoPendente),
      variant: "warning",
    });
  }
  if (c.haver > 0.009) {
    comCobranca.push({
      label: "Haver do ponto",
      valor: formatCurrency(c.haver),
      variant: "warning",
    });
  }
  return comCobranca;
}

export const RelatorioFuraFuraView = forwardRef<HTMLDivElement, { data: RelatorioFuraFuraData }>(
  function RelatorioFuraFuraView({ data }, ref) {
    const c = data.calculo;

    return (
      <div ref={ref} style={RELATORIO_SHELL_STYLE}>
        {data.previa && <RelatorioBadgePrevia />}

        <RelatorioCabecalho
          empresaNome={data.empresaNome}
          pontoNome={data.pontoNome}
          data={data.data}
          subtitulo={data.kitNome ? `Kit: ${data.kitNome}` : null}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <RelatorioCardSoft>
            <p style={{ margin: "0 0 8px", fontWeight: 600, color: colors.text }}>
              Fura-Fura{data.kitNome ? ` · ${data.kitNome}` : ""}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Furos</p>
                <p style={{ margin: "2px 0 0", color: colors.green, fontWeight: 500 }}>
                  {c.quantidadeFuros}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Preço / furo</p>
                <p style={{ margin: "2px 0 0", color: colors.slate300 }}>
                  {formatCurrency(c.precoFuro)}
                </p>
              </div>
            </div>
            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: `1px solid ${colors.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: colors.slate400 }}>Operação</span>
              <span style={{ fontWeight: 700, color: colors.cyan }}>
                {formatCurrency(c.valorAReceber)}
              </span>
            </div>
            <RelatorioFotoPainel
              fotoUrl={data.fotoUrl}
              alt="Foto da máquina"
              label="Foto da máquina"
            />
          </RelatorioCardSoft>
        </div>

        <RelatorioResumoFinanceiro linhas={buildLinhas(data)} />
      </div>
    );
  }
);
