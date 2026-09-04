"use client";

import { forwardRef } from "react";
import { formatCurrency } from "@/lib/utils";
import type { RelatorioBolinhaData } from "@/lib/nichos/bolinha/relatorio";
import type {
  RelatorioLinhaComprovante,
  RelatorioThemeMode,
} from "@/lib/coletas/relatorio-comprovante-theme";
import { appendLinhasCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";
import {
  RelatorioBadgePrevia,
  RelatorioCabecalho,
  RelatorioCardSoft,
  RelatorioFotoPainel,
  RelatorioResumoFinanceiro,
} from "@/components/coletas/relatorio/RelatorioComprovanteShell";
import {
  RelatorioViewRoot,
  useRelatorioTheme,
} from "@/components/coletas/relatorio/RelatorioThemeContext";

function buildLinhasResumo(data: RelatorioBolinhaData): RelatorioLinhaComprovante[] {
  const c = data.calculo;
  const linhas: RelatorioLinhaComprovante[] = [
    { label: "Operação", secao: true },
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
  linhas.push({ label: "Acerto desta visita", secao: true, dividerBefore: true });
  linhas.push({
    label: "Operação (desta visita)",
    valor: formatCurrency(c.valorAReceber),
    variant: "highlight",
    destaque: true,
  });
  if (c.custoBrindes > 0.009) {
    linhas.push({ label: "Custo cápsulas", valor: formatCurrency(c.custoBrindes) });
  }
  linhas.push({
    label: "Lucro real",
    valor: formatCurrency(c.lucroReal),
    variant: "success",
  });

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

function RelatorioBolinhaBody({ data }: { data: RelatorioBolinhaData }) {
  const { colors } = useRelatorioTheme();

  return (
    <>
      {data.previa && <RelatorioBadgePrevia />}
      <RelatorioCabecalho
        empresaNome={data.empresaNome}
        pontoNome={data.pontoNome}
        data={data.data}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {data.maquinas.map((m) => (
          <RelatorioCardSoft key={m.nome}>
            <p style={{ margin: "0 0 8px", fontWeight: 600, color: colors.text }}>{m.nome}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Contado</p>
                <p style={{ margin: "2px 0 0", color: colors.green, fontWeight: 500 }}>
                  {formatCurrency(m.valorContado)}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: colors.slate500 }}>Saiu</p>
                <p style={{ margin: "2px 0 0", color: colors.slate300 }}>{m.unidadesSaiu}</p>
              </div>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: colors.slate400 }}>
              Jogada {formatCurrency(m.precoJogada)}
            </p>
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
                {formatCurrency(m.valorBruto)}
              </span>
            </div>
            <RelatorioFotoPainel fotoUrl={m.fotoUrl} alt={`Foto ${m.nome}`} />
          </RelatorioCardSoft>
        ))}
      </div>

      <RelatorioResumoFinanceiro linhas={buildLinhasResumo(data)} />
    </>
  );
}

export const RelatorioBolinhaView = forwardRef<
  HTMLDivElement,
  { data: RelatorioBolinhaData; theme?: RelatorioThemeMode; fullWidth?: boolean }
>(function RelatorioBolinhaView({ data, theme = "light", fullWidth }, ref) {
  return (
    <RelatorioViewRoot ref={ref} theme={theme} fullWidth={fullWidth}>
      <RelatorioBolinhaBody data={data} />
    </RelatorioViewRoot>
  );
});
