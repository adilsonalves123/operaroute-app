import { calcularCheckoutVisita } from "@/lib/visitas-ponto/checkout";
import type { NichoResumoVisita, VisitaPontoResumo } from "@/lib/visitas-ponto/types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Valor do nicho no comprovante: após pagar, cobravel zera — usa o recebido. */
export function valorNichoComprovante(n: Pick<NichoResumoVisita, "totalCobravel" | "totalRecebido">): number {
  return round2(Math.max(n.totalCobravel, n.totalRecebido));
}

export type TotaisComprovanteVisita = {
  subtotal: number;
  totalACobrar: number;
  valorPago: number;
  restante: number;
  desconto: number;
  dividaSaldo: number;
  haverAbatido: number;
  haverGerado: number;
  haverRestante: number;
  totalBruto: number;
};

/**
 * Totais do comprovante / tela finalizada.
 * Depois do "receber agora", cobravel fica 0 — prioriza snapshot do checkout.
 */
export function totaisComprovanteVisita(
  resumo: VisitaPontoResumo,
  opts: {
    dividaSaldo?: number;
    desconto?: number;
    pix?: number;
    dinheiro?: number;
    haverSaldo?: number;
    descontarHaver?: boolean;
  } = {}
): TotaisComprovanteVisita {
  const checkout = resumo.checkout;
  const desconto = opts.desconto ?? checkout?.desconto ?? 0;
  const pix = opts.pix ?? checkout?.valorPix ?? 0;
  const dinheiro = opts.dinheiro ?? checkout?.valorDinheiro ?? 0;
  const dividaSaldo = opts.dividaSaldo ?? 0;
  const haverSaldo = round2(Math.max(0, opts.haverSaldo ?? 0));
  const descontarHaver = opts.descontarHaver === true;

  const subtotalNichos = round2(
    resumo.nichos.reduce((s, n) => s + valorNichoComprovante(n), 0)
  );

  if (resumo.status === "finalizada" && checkout) {
    const valorPago = round2(
      checkout.valorPago > 0.009 ? checkout.valorPago : resumo.totalRecebido
    );
    const subtotal = round2(
      Math.max(
        resumo.subtotalCobravel,
        subtotalNichos,
        valorPago - Math.max(0, dividaSaldo)
      )
    );
    const recompute = calcularCheckoutVisita({
      subtotalCobravel: Math.max(subtotal, subtotalNichos),
      dividaAnteriorTotal: dividaSaldo,
      dividaRecebidaInicio: 0,
      desconto: round2(checkout.desconto ?? desconto),
      pix,
      dinheiro,
      haverSaldo,
      descontarHaver,
    });
    const haverAbatido = recompute.haverAbatido;
    const totalBruto = round2(
      Math.max(
        recompute.subtotalAposDesconto + recompute.dividaSaldo,
        subtotal + dividaSaldo,
        checkout.totalCobrado + haverAbatido,
        valorPago + haverAbatido
      )
    );
    const totalACobrar = round2(
      checkout.totalCobrado > 0.009
        ? checkout.totalCobrado
        : Math.max(0, totalBruto - haverAbatido - valorPago) > 0.009
          ? Math.max(0, totalBruto - haverAbatido)
          : valorPago > 0.009
            ? valorPago
            : Math.max(0, totalBruto - haverAbatido)
    );
    const restante = round2(
      checkout.restante ?? Math.max(0, totalACobrar - valorPago)
    );

    return {
      subtotal,
      totalACobrar:
        haverAbatido > 0.009 && valorPago <= 0.009
          ? round2(Math.max(0, totalBruto - haverAbatido))
          : totalACobrar,
      valorPago,
      restante:
        haverAbatido > 0.009 && valorPago <= 0.009
          ? 0
          : restante,
      desconto: round2(checkout.desconto ?? desconto),
      dividaSaldo: round2(dividaSaldo),
      haverAbatido,
      haverGerado: round2(Math.max(0, valorPago - totalACobrar)),
      haverRestante: round2(Math.max(0, haverSaldo - haverAbatido)),
      totalBruto,
    };
  }

  const calculo = calcularCheckoutVisita({
    subtotalCobravel: Math.max(resumo.subtotalCobravel, subtotalNichos),
    dividaAnteriorTotal: dividaSaldo,
    dividaRecebidaInicio: 0,
    desconto,
    pix,
    dinheiro,
    haverSaldo,
    descontarHaver,
  });

  const totalBruto = round2(
    calculo.subtotalAposDesconto + calculo.dividaSaldo
  );

  return {
    subtotal: round2(Math.max(resumo.subtotalCobravel, subtotalNichos)),
    totalACobrar: calculo.totalACobrar,
    valorPago: calculo.valorPago,
    restante: calculo.restante,
    desconto: calculo.desconto,
    dividaSaldo: round2(dividaSaldo),
    haverAbatido: calculo.haverAbatido,
    haverGerado: calculo.haver,
    haverRestante: round2(Math.max(0, haverSaldo - calculo.haverAbatido)),
    totalBruto,
  };
}
