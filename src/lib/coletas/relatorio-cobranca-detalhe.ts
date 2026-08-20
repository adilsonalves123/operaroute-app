import { formatCurrency } from "@/lib/utils";
import type { RelatorioLinhaComprovante } from "@/lib/coletas/relatorio-comprovante-theme";

/** Detalhe de cobrança (pendência/haver) nos comprovantes fora do cassino. */
export type RelatorioCobrancaDetalhe = {
  /** Dívida/pendência anterior incluída nesta cobrança. */
  dividaAnterior?: number;
  /** Haver que o ponto tinha antes. */
  haverAnterior?: number;
  /** Quanto do haver foi abatido nesta cobrança. */
  haverAbatido?: number;
  /** Total cobrado (operação ± pendência − haver). */
  totalACobrar?: number;
};

/** Insere linhas de dívida/haver/total real no resumo do relatório. */
export function appendLinhasCobrancaDetalhe(
  linhas: RelatorioLinhaComprovante[],
  d?: RelatorioCobrancaDetalhe | null
): RelatorioLinhaComprovante[] {
  if (!d) return linhas;

  const divida = Number(d.dividaAnterior ?? 0);
  const haverAnt = Number(d.haverAnterior ?? 0);
  const haverAbt = Number(d.haverAbatido ?? 0);
  const total = Number(d.totalACobrar ?? 0);
  const temDetalhe =
    divida > 0.009 || haverAnt > 0.009 || haverAbt > 0.009 || total > 0.009;

  if (!temDetalhe) return linhas;

  const out = [...linhas];
  out.push({
    label: "Cobrança",
    secao: true,
    dividerBefore: true,
  });

  if (divida > 0.009) {
    out.push({
      label: "Dívida anterior",
      valor: `+ ${formatCurrency(divida)}`,
      variant: "warning",
    });
  }
  if (haverAnt > 0.009) {
    out.push({
      label: "Haver anterior",
      valor: formatCurrency(haverAnt),
      variant: "warning",
    });
  }
  if (haverAbt > 0.009) {
    out.push({
      label: "Abatido do haver",
      valor: `− ${formatCurrency(haverAbt)}`,
      variant: "discount",
    });
  }
  if (total > 0.009) {
    out.push({
      label: "Total a cobrar",
      valor: formatCurrency(total),
      variant: "highlight",
      destaque: true,
    });
  }

  return out;
}
