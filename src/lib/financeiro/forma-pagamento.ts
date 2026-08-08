import type { FormaPagamento } from "@/lib/types/database";

export function deriveFormaPagamento(pix: number, dinheiro: number): FormaPagamento {
  if (pix > 0.009 && dinheiro > 0.009) return "misto";
  if (pix > 0.009) return "pix";
  return "dinheiro";
}

export function formatPagamentoDetalhe(pix: number, dinheiro: number): string {
  const partes: string[] = [];
  if (pix > 0.009) {
    partes.push(`Pix R$ ${pix.toFixed(2).replace(".", ",")}`);
  }
  if (dinheiro > 0.009) {
    partes.push(`Dinheiro R$ ${dinheiro.toFixed(2).replace(".", ",")}`);
  }
  return partes.join(" · ");
}

export function labelFormaPagamento(
  forma: FormaPagamento | string | null | undefined,
  pix?: number | null,
  dinheiro?: number | null
): string {
  const p = Number(pix ?? 0);
  const d = Number(dinheiro ?? 0);
  if (p > 0.009 || d > 0.009) {
    const detalhe = formatPagamentoDetalhe(p, d);
    if (detalhe) return detalhe;
  }
  if (forma === "misto") return "Misto";
  if (forma === "pix") return "Pix";
  if (forma === "dinheiro") return "Dinheiro";
  return "—";
}
