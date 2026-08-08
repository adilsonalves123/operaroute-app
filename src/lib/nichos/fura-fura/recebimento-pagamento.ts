import { parseMoneyInput } from "@/lib/utils";
import { deriveFormaPagamento } from "@/lib/financeiro/forma-pagamento";

export type RecebimentoPixDinheiro = {
  pix: number;
  dinheiro: number;
  total: number;
  forma: ReturnType<typeof deriveFormaPagamento>;
};

export function parseRecebimentoPixDinheiro(body: {
  valor_pix?: unknown;
  valor_dinheiro?: unknown;
  pix?: unknown;
  dinheiro?: unknown;
  valor?: unknown;
  valor_pago_recebido?: unknown;
  forma_pagamento?: string;
}): { ok: true; data: RecebimentoPixDinheiro } | { ok: false; error: string } {
  let pix = parseMoneyInput(
    (body.valor_pix ?? body.pix) as string | number | null | undefined
  );
  let dinheiro = parseMoneyInput(
    (body.valor_dinheiro ?? body.dinheiro) as string | number | null | undefined
  );
  const legacyTotal =
    Number(body.valor_pago_recebido ?? body.valor ?? 0) || 0;

  if (pix <= 0.009 && dinheiro <= 0.009) {
    if (legacyTotal <= 0.009) {
      return {
        ok: true,
        data: { pix: 0, dinheiro: 0, total: 0, forma: "dinheiro" },
      };
    }

    const forma = body.forma_pagamento ?? "dinheiro";
    if (forma === "misto") {
      return {
        ok: false,
        error: "Informe quanto foi Pix e quanto foi dinheiro.",
      };
    }
    if (forma === "pix") pix = legacyTotal;
    else dinheiro = legacyTotal;
  }

  const total = Math.round((pix + dinheiro) * 100) / 100;
  if (total <= 0.009) {
    return {
      ok: true,
      data: { pix: 0, dinheiro: 0, total: 0, forma: "dinheiro" },
    };
  }

  if (legacyTotal > 0.009 && Math.abs(total - legacyTotal) > 0.009) {
    return {
      ok: false,
      error: "Pix + dinheiro deve ser igual ao valor recebido.",
    };
  }

  return {
    ok: true,
    data: {
      pix,
      dinheiro,
      total,
      forma: deriveFormaPagamento(pix, dinheiro),
    },
  };
}
