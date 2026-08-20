"use client";

import { forwardRef } from "react";
import { formatCurrency } from "@/lib/utils";
import type { RelatorioConsignadoData } from "@/lib/nichos/consignado/relatorio";
import type { RelatorioLinhaComprovante } from "@/lib/coletas/relatorio-comprovante-theme";
import { appendLinhasCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";
import {
  RelatorioBadgePrevia,
  RelatorioCabecalho,
  RelatorioCardSoft,
  RelatorioResumoFinanceiro,
  RELATORIO_COLORS as colors,
  RELATORIO_SHELL_STYLE,
} from "@/components/coletas/relatorio/RelatorioComprovanteShell";

function buildLinhasResumo(data: RelatorioConsignadoData): RelatorioLinhaComprovante[] {
  const c = data.calculo;
  const linhas: RelatorioLinhaComprovante[] = [
    { label: "Operação", secao: true },
    { label: "Vendido (bruto)", valor: formatCurrency(c.valorBruto) },
    {
      label:
        c.modoComissao === "tabela"
          ? "Repasse ao cliente (tabela)"
          : `Comissão do cliente (${c.comissaoPercentual}%)`,
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
  linhas.push({ label: "Separar p/ custo", valor: formatCurrency(c.custoProdutos) });
  linhas.push({
    label: "Livre pra você (lucro)",
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

export const RelatorioConsignadoView = forwardRef<
  HTMLDivElement,
  { data: RelatorioConsignadoData }
>(function RelatorioConsignadoView({ data }, ref) {
  return (
    <div ref={ref} style={RELATORIO_SHELL_STYLE}>
      {data.previa && <RelatorioBadgePrevia />}
      <RelatorioCabecalho
        empresaNome={data.empresaNome}
        pontoNome={data.pontoNome}
        data={data.data}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {data.expositores.map((exp) => {
          const vendidas = exp.linhas.filter((l) => l.vendido > 0);
          return (
            <RelatorioCardSoft key={exp.nome}>
              <p style={{ margin: "0 0 8px", fontWeight: 600, color: colors.text }}>{exp.nome}</p>
              {vendidas.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: colors.slate500 }}>
                  Nenhuma venda neste expositor.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {vendidas.map((l) => (
                    <div
                      key={`${l.produtoId ?? l.nome}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, color: colors.text, fontWeight: 600 }}>
                          {l.vendido} × {l.nome}
                          {l.codigo ? (
                            <span style={{ color: colors.slate500, fontWeight: 500 }}>
                              {" "}
                              ({l.codigo})
                            </span>
                          ) : null}
                        </p>
                        <p style={{ margin: "2px 0 0", color: colors.slate400, fontSize: 11 }}>
                          {formatCurrency(l.precoVenda)} un
                          {l.comissaoFixa != null && Number(l.comissaoFixa) > 0.009
                            ? ` · cliente ${formatCurrency(Number(l.comissaoFixa))}/un`
                            : ""}
                          {l.comissao > 0.009
                            ? ` · repasse ${formatCurrency(l.comissao)}`
                            : ""}
                        </p>
                      </div>
                      <span style={{ color: colors.text, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {formatCurrency(l.receita)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
                  {formatCurrency(exp.valorBruto)}
                </span>
              </div>
            </RelatorioCardSoft>
          );
        })}
      </div>

      <RelatorioResumoFinanceiro linhas={buildLinhasResumo(data)} />
    </div>
  );
});
