"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { labelFormaPagamento } from "@/lib/financeiro/forma-pagamento";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import type { Coleta } from "@/lib/types/database";
import { Package, ChevronRight } from "lucide-react";
import { NICHO_MODULO_URSINHO } from "@/lib/nichos/ursinho";
import { NICHO_MODULO_DIVERSAO } from "@/lib/nichos/diversao";
import { NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";

type ColetaWithPonto = Coleta & {
  pontos?: { nome: string; cidade: string | null } | null;
};

function hrefForColeta(coleta: ColetaWithPonto): string | null {
  if (coleta.nicho_modulo === NICHO_MODULO_URSINHO) return `/coletas/ursinho/${coleta.id}`;
  if (coleta.nicho_modulo === NICHO_MODULO_DIVERSAO) return `/coletas/diversao/${coleta.id}`;
  if (coleta.nicho_modulo === NICHO_MODULO_BOLINHA) return `/coletas/bolinha/${coleta.id}`;
  return null;
}

function accentForColeta(coleta: ColetaWithPonto, pendente: boolean): string {
  if (pendente) return "bg-amber-400";
  if (coleta.nicho_modulo === NICHO_MODULO_URSINHO) return "bg-pink-400";
  if (coleta.nicho_modulo === NICHO_MODULO_BOLINHA) return "bg-orange-400";
  return "bg-cyan-400";
}

export function ColetasClient({
  coletas,
  novaColetaHref = "/coletas/nova",
}: {
  coletas: ColetaWithPonto[];
  novaColetaHref?: string;
}) {
  if (coletas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma coleta registrada"
        description="Nenhuma coleta registrada ainda. Faça sua primeira coleta para ver seus resultados."
        actionLabel="Nova coleta"
        actionHref={novaColetaHref}
        icon={<Package className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.01]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Histórico
        </p>
        <p className="text-xs tabular-nums text-slate-600">
          {coletas.length} coleta{coletas.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ul className="divide-y divide-white/[0.04]">
        {coletas.map((coleta) => {
          const isUrsinho = coleta.nicho_modulo === NICHO_MODULO_URSINHO;
          const isDiversao = coleta.nicho_modulo === NICHO_MODULO_DIVERSAO;
          const isBolinha = coleta.nicho_modulo === NICHO_MODULO_BOLINHA;
          const valor = Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0);
          const saldoPendente =
            isUrsinho || isDiversao || isBolinha ? saldoPendenteColeta(coleta) : 0;
          const pendente = saldoPendente > 0.009;
          const formaPagamento = labelFormaPagamento(
            coleta.forma_pagamento,
            coleta.valor_pix,
            coleta.valor_dinheiro
          );
          const href = hrefForColeta(coleta);

          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-3 left-0 w-0.5 rounded-full opacity-0 transition group-hover:opacity-100",
                  accentForColeta(coleta, pendente)
                )}
              />

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-white">
                    {coleta.pontos?.nome ?? "Ponto"}
                  </p>
                  {pendente && (
                    <span className="inline-flex items-center rounded-md bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200 ring-1 ring-inset ring-amber-500/25">
                      Pendente {formatCurrency(saldoPendente)}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-slate-400">{formatDateTime(coleta.created_at)}</p>
                <p className="text-[11px] text-slate-600">
                  {formaPagamento !== "—" ? formaPagamento : "Sem forma"}
                  {coleta.observacao ? (
                    <>
                      <span className="mx-1.5 text-slate-700">·</span>
                      <span className="truncate">{coleta.observacao}</span>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums tracking-tight text-emerald-300 sm:text-lg">
                    {formatCurrency(valor)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
                    lucro
                  </p>
                </div>
                {href ? (
                  <ChevronRight className="h-4 w-4 text-slate-700 transition duration-200 group-hover:translate-x-0.5 group-hover:text-cyan-400/80" />
                ) : (
                  <span className="h-4 w-4" />
                )}
              </div>
            </>
          );

          const rowClass = cn(
            "group relative flex items-center gap-3 px-4 py-3.5 transition duration-200 sm:gap-4 sm:px-5 sm:py-4",
            "hover:bg-white/[0.03]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-inset"
          );

          return (
            <li key={coleta.id}>
              {href ? (
                <Link href={href} className={rowClass}>
                  {body}
                </Link>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
