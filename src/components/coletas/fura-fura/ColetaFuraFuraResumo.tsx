"use client";

import { resumoColetaFuraFura } from "@/lib/nichos/fura-fura/resumo-coleta";
import { calcularRecebimentoComPendencia } from "@/lib/nichos/fura-fura/recebimento-pendencia";
import { totalCobrancaNicho } from "@/lib/coletas/total-cobranca-nicho";
import type { CalculoColetaFuraFuraResult } from "@/lib/nichos/fura-fura/calculo-coleta";
import type { ResumoPendenciaPonto } from "@/lib/nichos/fura-fura/pendencia-ponto";
import {
  ColetaOpcoesCobrancaHaver,
  ColetaOpcoesCobrancaPendencia,
} from "@/components/coletas/ColetaHaverPendenciaPanel";
import { ColetaReceberClienteBox } from "@/components/coletas/ColetaReceberClienteBox";
import { ColetaContinuarPagamentoHint } from "@/components/coletas/ColetaContinuarPagamentoHint";
import { ColetaRecebimentoFields } from "@/components/coletas/layout";
import { ComissaoStaffLinha } from "@/components/equipe/ComissaoStaffLinha";
import type { RelatorioCobrancaDetalhe } from "@/lib/coletas/relatorio-cobranca-detalhe";
import { cn, formatCurrency } from "@/lib/utils";
import type { ReactNode } from "react";

type RecebimentoFields = {
  desconto: string;
  pix: string;
  dinheiro: string;
  onDescontoChange: (value: string) => void;
  onPixChange: (value: string) => void;
  onDinheiroChange: (value: string) => void;
};

export function ColetaFuraFuraResumo({
  calculo,
  className,
  pendenciaPonto,
  haverSaldo = 0,
  descontarHaver = false,
  onDescontarHaverChange,
  incluirPendencia = false,
  onIncluirPendenciaChange,
  recebimento,
  modoVisitaPonto = false,
  receberAgora = false,
  finalizarSemPagar = false,
  modoFecharSlot,
  cobrancaSalva = null,
  totalPagoVisita,
}: {
  calculo: CalculoColetaFuraFuraResult;
  className?: string;
  pendenciaPonto?: ResumoPendenciaPonto | null;
  haverSaldo?: number;
  descontarHaver?: boolean;
  onDescontarHaverChange?: (v: boolean) => void;
  incluirPendencia?: boolean;
  onIncluirPendenciaChange?: (v: boolean) => void;
  recebimento?: RecebimentoFields;
  modoVisitaPonto?: boolean;
  receberAgora?: boolean;
  finalizarSemPagar?: boolean;
  modoFecharSlot?: ReactNode;
  /** Dívida anterior quitada nesta coleta (detalhe salvo). */
  cobrancaSalva?: RelatorioCobrancaDetalhe | null;
  /** Pix + dinheiro informados na visita (pode incluir dívida). */
  totalPagoVisita?: number;
}) {
  const resumo = resumoColetaFuraFura(calculo);
  const mostrandoPagamento = !modoVisitaPonto || receberAgora;
  const pendenciaSaldo = pendenciaPonto?.totalPendente ?? 0;

  const cobranca = totalCobrancaNicho({
    valorOperacao: resumo.valorAReceber,
    pendenciaSaldo,
    incluirPendencia,
    haverSaldo,
    descontarHaver,
  });

  const recebimentoCalculado =
    mostrandoPagamento && calculo.valorPagoRecebido > 0.009
      ? calcularRecebimentoComPendencia(
          cobranca.valorOperacao - cobranca.haverDescontado,
          calculo.valorPagoRecebido,
          pendenciaSaldo
        )
      : null;

  const faltaCobranca = Math.max(0, cobranca.totalACobrar - calculo.valorPagoRecebido);
  const hint =
    incluirPendencia && pendenciaSaldo > 0.009
      ? "Valor acima quita a dívida anterior do ponto."
      : "Zero = saldo fica pendente para cobrar depois.";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-primary-neon/25 bg-gradient-to-b from-primary-neon/10 to-transparent p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-neon/80">
          {modoVisitaPonto && !mostrandoPagamento
            ? "Valor desta operação"
            : mostrandoPagamento
              ? "Valor da operação"
              : "A receber nesta coleta"}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-primary-neon">
          {formatCurrency(resumo.valorAReceber)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Lucro real:{" "}
          <span className="font-medium text-green-400">{formatCurrency(resumo.lucroReal)}</span>
          <span className="mx-1.5 text-slate-600">·</span>
          {calculo.quantidadeFuros} furos
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <span className="text-slate-500">Bruto</span>
        <span className="text-right tabular-nums text-slate-200">{formatCurrency(calculo.valorBruto)}</span>
        <span className="text-slate-500">Comissão</span>
        <span className="text-right tabular-nums text-amber-300">{formatCurrency(calculo.valorComissao)}</span>
        {calculo.desconto > 0.009 && (
          <>
            <span className="text-slate-500">Desconto</span>
            <span className="text-right tabular-nums text-rose-300">− {formatCurrency(calculo.desconto)}</span>
          </>
        )}
        {calculo.custoBrindes > 0.009 && (
          <>
            <span className="text-slate-500">Brindes</span>
            <span className="text-right tabular-nums text-rose-300/90">
              {formatCurrency(calculo.custoBrindes)}
            </span>
          </>
        )}
      </div>

      <ComissaoStaffLinha lucroAposBrindes={resumo.lucroReal} />

      {modoVisitaPonto && modoFecharSlot}

      {/* Receber agora (ou coleta avulsa): haver / pendência / pix */}
      {recebimento && mostrandoPagamento ? (
        <div className="space-y-3">
          {onDescontarHaverChange && (
            <ColetaOpcoesCobrancaHaver
              haverSaldo={haverSaldo}
              descontarHaver={descontarHaver}
              onDescontarHaverChange={onDescontarHaverChange}
            />
          )}

          <ColetaReceberClienteBox
            valorOperacao={resumo.valorAReceber}
            pendenciaSaldo={pendenciaSaldo}
            incluirPendencia={incluirPendencia}
            haverSaldo={haverSaldo}
            descontarHaver={descontarHaver}
          />

          {onIncluirPendenciaChange && (
            <ColetaOpcoesCobrancaPendencia
              pendenciaSaldo={pendenciaSaldo}
              incluirPendencia={incluirPendencia}
              onIncluirPendenciaChange={onIncluirPendenciaChange}
            />
          )}

          <ColetaRecebimentoFields
            {...recebimento}
            hint={
              modoVisitaPonto
                ? "Recebe esta coleta agora. O que faltar (e outros nichos) fica no Cobrar."
                : hint
            }
            status={
              calculo.valorPagoRecebido > 0.009
                ? {
                    valorPago: calculo.valorPagoRecebido,
                    saldoPendente: faltaCobranca,
                    haver: recebimentoCalculado?.haver ?? 0,
                    quitado: faltaCobranca <= 0.009,
                  }
                : null
            }
          />
        </div>
      ) : recebimento && modoVisitaPonto ? (
        <div className="space-y-3">
          {finalizarSemPagar ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-3 text-xs text-slate-400">
              Fecha a visita sem cobrar agora. O saldo fica{" "}
              <strong className="text-amber-300">pendente</strong>.
            </div>
          ) : (
            <>
              <ColetaRecebimentoFields
                {...recebimento}
                somenteDesconto
                hint="Desconto só desta operação (opcional)."
              />
              <ColetaContinuarPagamentoHint />
            </>
          )}
        </div>
      ) : calculo.valorPagoRecebido > 0.009 ? (
        <div className="border-t border-slate-800 pt-4 space-y-2 text-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Recebimento
          </p>
          {(cobrancaSalva?.dividaAnterior ?? 0) > 0.009 ? (
            <div className="flex justify-between gap-3">
              <span className="text-amber-300">Dívida anterior quitada</span>
              <span className="font-semibold text-amber-400 tabular-nums">
                {formatCurrency(cobrancaSalva!.dividaAnterior!)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Recebido desta coleta</span>
            <span className="font-semibold text-green-400 tabular-nums">
              {formatCurrency(calculo.valorPagoRecebido)}
            </span>
          </div>
          {totalPagoVisita != null &&
          totalPagoVisita > calculo.valorPagoRecebido + 0.009 ? (
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">Total pago na visita</span>
              <span className="font-medium text-slate-200 tabular-nums">
                {formatCurrency(totalPagoVisita)}
              </span>
            </div>
          ) : null}
          {calculo.saldoPendente > 0.009 ? (
            <div className="flex justify-between gap-3">
              <span className="text-amber-300">Pendente</span>
              <span className="font-bold text-amber-400 tabular-nums">
                {formatCurrency(calculo.saldoPendente)}
              </span>
            </div>
          ) : calculo.haver > 0.009 ? (
            <div className="flex justify-between gap-3">
              <span className="text-cyan-300">Haver</span>
              <span className="font-bold text-cyan-400 tabular-nums">
                + {formatCurrency(calculo.haver)}
              </span>
            </div>
          ) : (
            <p className="text-green-400">Quitado</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
