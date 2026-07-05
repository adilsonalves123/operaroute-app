import { formatCurrency } from "@/lib/utils";

export type MovimentoCaixaDetalhe = {
  pixReais: number;
  dinheiroReais: number;
  pixDoCaixa: boolean;
  dinheiroDoCaixa: boolean;
};

export function valorMovimentoCaixa(d: MovimentoCaixaDetalhe): number {
  let total = 0;
  if (d.pixReais > 0.009 && d.pixDoCaixa) total += d.pixReais;
  if (d.dinheiroReais > 0.009 && d.dinheiroDoCaixa) total += d.dinheiroReais;
  return total;
}

export function valorForaCaixa(d: MovimentoCaixaDetalhe): number {
  const total = d.pixReais + d.dinheiroReais;
  return Math.max(0, total - valorMovimentoCaixa(d));
}

export function hintMovimentoCaixa(
  d: MovimentoCaixaDetalhe,
  modo: "entrada" | "saida"
): string | undefined {
  const partes: string[] = [];
  const verbo = modo === "entrada" ? "entrou" : "saiu";

  if (d.pixReais > 0.009) {
    partes.push(
      `Pix ${formatCurrency(d.pixReais)}${d.pixDoCaixa ? ` (${verbo} do caixa)` : " (fora do caixa)"}`
    );
  }
  if (d.dinheiroReais > 0.009) {
    partes.push(
      `Dinheiro ${formatCurrency(d.dinheiroReais)}${d.dinheiroDoCaixa ? ` (${verbo} do caixa)` : " (fora do caixa)"}`
    );
  }
  return partes.length > 0 ? partes.join(" · ") : undefined;
}
