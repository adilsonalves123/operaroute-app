"use client";

import { calcularRecebimentoComPendencia } from "@/lib/nichos/fura-fura/recebimento-pendencia";
import { totalCobrancaNicho } from "@/lib/coletas/total-cobranca-nicho";
import type { CalculoColetaConsignado } from "@/lib/nichos/consignado";
import type { ResumoPendenciaPonto } from "@/lib/nichos/fura-fura/pendencia-ponto";
import {
  ColetaOpcoesCobrancaHaver,
  ColetaOpcoesCobrancaPendencia,
} from "@/components/coletas/ColetaHaverPendenciaPanel";
import { ColetaReceberClienteBox } from "@/components/coletas/ColetaReceberClienteBox";
import { ColetaContinuarPagamentoHint } from "@/components/coletas/ColetaContinuarPagamentoHint";
import { ColetaRecebimentoFields } from "@/components/coletas/layout";
import { ComissaoStaffLinha } from "@/components/equipe/ComissaoStaffLinha";
import { cn, formatCurrency } from "@/lib/utils";
import { Package, Wallet } from "lucide-react";
import type { ReactNode } from "react";

type RecebimentoFields = {
  desconto: string;
  pix: string;
  dinheiro: string;
  onDescontoChange: (value: string) => void;
  onPixChange: (value: string) => void;
  onDinheiroChange: (value: string) => void;
};

export function ColetaConsignadoResumo({
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
}: {
  calculo: CalculoColetaConsignado;
  className?: string;
  pendenciaPonto?: ResumoPendenciaPonto | null;
  haverSaldo?: number;
  descontarHaver?: boolean;
  onDescontarHaverChange?: (v: boolean) => void;
  incluirPendencia?: boolean;
  onIncluirPendenciaChange?: (v: boolean) => void;
  recebimento: RecebimentoFields;
  modoVisitaPonto?: boolean;
  receberAgora?: boolean;
  finalizarSemPagar?: boolean;
  modoFecharSlot?: ReactNode;
}) {
  const mostrandoPagamento = !modoVisitaPonto || receberAgora;
  const pendenciaSaldo = pendenciaPonto?.totalPendente ?? 0;

  const cobranca = totalCobrancaNicho({
    valorOperacao: calculo.valorAReceber,
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
  const unidades = calculo.totalVendido;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-transparent p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
          Vendido (bruto)
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-200">
          {formatCurrency(calculo.valorBruto)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {unidades} {unidades === 1 ? "unidade" : "unidades"} · {calculo.linhas.length} produtos
        </p>
      </div>

      {calculo.linhas.some((l) => l.vendido > 0) && (
        <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Comprovante
          </p>
          {calculo.linhas
            .filter((l) => l.vendido > 0)
            .map((l) => (
              <div
                key={l.produtoId ?? l.nome}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="text-slate-200">
                    <span className="font-semibold tabular-nums text-white">{l.vendido}</span>
                    {" × "}
                    {l.nome}
                    {l.codigo ? (
                      <span className="text-slate-500"> ({l.codigo})</span>
                    ) : null}
                  </p>
                  <p className="text-slate-500">
                    {formatCurrency(l.precoVenda)} un
                    {l.comissaoFixa != null && Number(l.comissaoFixa) > 0
                      ? ` · cliente ${formatCurrency(Number(l.comissaoFixa))}/un`
                      : ""}
                    {l.comissao > 0.009
                      ? ` · repasse ${formatCurrency(l.comissao)}`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums font-medium text-slate-200">
                  {formatCurrency(l.receita)}
                </span>
              </div>
            ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <span className="text-slate-500">
          {calculo.modoComissao === "tabela"
            ? "Repasse ao cliente (tabela)"
            : `Comissão do cliente (${calculo.comissaoPercentual}%)`}
        </span>
        <span className="text-right tabular-nums text-amber-300">
          {formatCurrency(calculo.valorComissao)}
        </span>
        {calculo.desconto > 0.009 && (
          <>
            <span className="text-slate-500">Desconto</span>
            <span className="text-right tabular-nums text-rose-300">
              − {formatCurrency(calculo.desconto)}
            </span>
          </>
        )}
        <span className="text-slate-500">Valor da operação</span>
        <span className="text-right tabular-nums font-semibold text-orange-200">
          {formatCurrency(calculo.valorAReceber)}
        </span>
      </div>

      <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/25 p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-amber-300/90">
            <Package className="h-3.5 w-3.5" />
            Separar p/ custo
          </span>
          <span className="font-semibold tabular-nums text-amber-400">
            {formatCurrency(calculo.custoProdutos)}
          </span>
        </div>
        <div className="border-t border-white/[0.08] pt-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-green-400/90">
                <Wallet className="h-3.5 w-3.5" />
                Livre pra você (lucro)
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Depois de comissão e custo dos produtos
              </p>
            </div>
            <p className="text-xl font-bold tabular-nums text-green-400">
              {formatCurrency(calculo.lucroReal)}
            </p>
          </div>
        </div>
      </div>

      <ComissaoStaffLinha lucroAposBrindes={calculo.lucroReal} />

      {modoVisitaPonto && modoFecharSlot}

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
            valorOperacao={calculo.valorAReceber}
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
            <div className="rounded-lg border border-orange-500/25 bg-orange-500/5 px-3 py-3 text-xs text-slate-400">
              Fecha a visita sem cobrar agora. O saldo fica{" "}
              <strong className="text-orange-300">pendente</strong>.
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
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Recebido</span>
            <span className="font-semibold text-green-400 tabular-nums">
              {formatCurrency(calculo.valorPagoRecebido)}
            </span>
          </div>
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
