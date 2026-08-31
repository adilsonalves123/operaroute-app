import {
  cobrancaDetalheFromColetaSalva,
  totalPagoInformadoColeta,
  type ColetaCobrancaSalvaRow,
} from "@/lib/coletas/cobranca-coleta-salva";
import { labelFormaPagamento } from "@/lib/financeiro/forma-pagamento";
import { formatCurrency } from "@/lib/utils";

type PagamentoColetaRow = {
  forma_pagamento?: string | null;
  valor_pix?: number | null;
  valor_dinheiro?: number | null;
};

type Props = {
  coleta: ColetaCobrancaSalvaRow & { forma_pagamento?: string | null };
  valorPago: number;
  saldoPendente: number;
  pagamentoColeta?: PagamentoColetaRow | null;
};

/** Cards de recebimento no histórico da coleta (com dívida anterior, se houver). */
export function ColetaHistoricoRecebimentoCards({
  coleta,
  valorPago,
  saldoPendente,
  pagamentoColeta,
}: Props) {
  const cobranca = cobrancaDetalheFromColetaSalva(coleta);
  const divida = cobranca?.dividaAnterior ?? 0;
  const totalPagoVisita = totalPagoInformadoColeta(coleta);
  const formaPagamentoColeta = labelFormaPagamento(
    pagamentoColeta?.forma_pagamento ?? coleta.forma_pagamento,
    pagamentoColeta?.valor_pix ?? coleta.valor_pix,
    pagamentoColeta?.valor_dinheiro ?? coleta.valor_dinheiro
  );
  const formaPagamentoVisita =
    totalPagoVisita > valorPago + 0.009
      ? labelFormaPagamento(coleta.forma_pagamento, coleta.valor_pix, coleta.valor_dinheiro)
      : null;

  return (
    <>
      {divida > 0.009 ? (
        <div className="rounded-lg bg-slate-950/50 p-3">
          <p className="text-xs text-slate-500">Dívida anterior quitada</p>
          <p className="font-semibold text-amber-400 tabular-nums">{formatCurrency(divida)}</p>
        </div>
      ) : null}
      <div className="rounded-lg bg-slate-950/50 p-3">
        <p className="text-xs text-slate-500">Recebido desta coleta</p>
        <p className="font-semibold text-green-400 tabular-nums">{formatCurrency(valorPago)}</p>
        <p className="mt-1 text-xs text-slate-500">{formaPagamentoColeta}</p>
      </div>
      {formaPagamentoVisita ? (
        <div className="rounded-lg bg-slate-950/50 p-3">
          <p className="text-xs text-slate-500">Total pago na visita</p>
          <p className="font-semibold text-slate-200 tabular-nums">
            {formatCurrency(totalPagoVisita)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formaPagamentoVisita}</p>
        </div>
      ) : null}
      <div className="rounded-lg bg-slate-950/50 p-3">
        <p className="text-xs text-slate-500">Saldo pendente</p>
        <p
          className={`font-semibold tabular-nums ${saldoPendente > 0.009 ? "text-amber-400" : "text-green-400"}`}
        >
          {formatCurrency(saldoPendente)}
        </p>
      </div>
    </>
  );
}

export function cobrancaFromColetaRow(
  coleta: ColetaCobrancaSalvaRow
): ReturnType<typeof cobrancaDetalheFromColetaSalva> {
  return cobrancaDetalheFromColetaSalva(coleta);
}
