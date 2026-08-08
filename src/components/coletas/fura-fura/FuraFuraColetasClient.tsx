"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import type { Coleta } from "@/lib/types/database";
import { Package, AlertTriangle, ChevronRight } from "lucide-react";

export type ColetaFuraListItem = Coleta & {
  pontos?: { nome: string; cidade: string | null; whatsapp?: string | null } | null;
  valor_a_receber?: number | null;
  valor_pago_recebido?: number | null;
  lucro_real?: number | null;
  quantidade_furos?: number | null;
};

type ResumoPendente = {
  pontoId: string;
  pontoNome: string;
  total: number;
  coletasAbertas: number;
};

function buildResumoPendentes(coletas: ColetaFuraListItem[]): ResumoPendente[] {
  const map = new Map<string, ResumoPendente>();

  for (const coleta of coletas) {
    const saldo = saldoPendenteColeta(coleta);
    if (saldo <= 0.009 || !coleta.ponto_id) continue;

    const prev = map.get(coleta.ponto_id);
    if (prev) {
      prev.total += saldo;
      prev.coletasAbertas += 1;
    } else {
      map.set(coleta.ponto_id, {
        pontoId: coleta.ponto_id,
        pontoNome: coleta.pontos?.nome ?? "Ponto",
        total: saldo,
        coletasAbertas: 1,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

function FuraFuraPendentesPanel({ coletas }: { coletas: ColetaFuraListItem[] }) {
  const resumo = buildResumoPendentes(coletas);
  const totalGeral = resumo.reduce((s, r) => s + r.total, 0);

  return (
    <aside className="h-fit space-y-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-amber-500/[0.06] to-white/[0.01] p-5 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Pendências
        </h2>
        {totalGeral > 0.009 && (
          <span className="text-sm font-semibold tabular-nums text-amber-300">
            {formatCurrency(totalGeral)}
          </span>
        )}
      </div>

      {resumo.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma coleta em aberto.</p>
      ) : (
        <ul className="space-y-2">
          {resumo.map((item) => (
            <li key={item.pontoId}>
              <Link
                href={`/coletas/pendentes?ponto=${item.pontoId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition hover:border-amber-500/25 hover:bg-amber-500/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{item.pontoNome}</p>
                  <p className="text-xs text-slate-500">
                    {item.coletasAbertas} em aberto
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-amber-300">
                  {formatCurrency(item.total)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/coletas/pendentes"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-500/10"
      >
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        Cobrar pendências
      </Link>
    </aside>
  );
}

function FuraFuraColetasLista({ coletas }: { coletas: ColetaFuraListItem[] }) {
  if (coletas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma coleta registrada"
        description="Faça sua primeira coleta fura-fura para ver o histórico."
        actionLabel="Nova coleta"
        actionHref="/coletas/nova/fura-fura"
        icon={<Package className="h-8 w-8" />}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Histórico
        </p>
        <p className="text-xs tabular-nums text-slate-600">
          {coletas.length} coleta{coletas.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ul className="space-y-2.5">
        {coletas.map((coleta) => {
          const pendente = saldoPendenteColeta(coleta);
          const lucro = Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0);
          const cobrado = Number(coleta.valor_pago_recebido ?? 0);
          const aReceber = Number(coleta.valor_a_receber ?? coleta.valor_liquido ?? 0);

          return (
            <li key={coleta.id}>
              <Link
                href={`/coletas/fura-fura/${coleta.id}`}
                className={cn(
                  "group relative flex items-stretch overflow-hidden rounded-2xl border border-white/[0.07]",
                  "bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-950/60",
                  "transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/25 hover:shadow-[0_18px_40px_-28px_rgba(34,211,238,0.55)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-1 shrink-0",
                    pendente > 0.009 ? "bg-amber-400" : "bg-emerald-400/80"
                  )}
                />

                <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 sm:gap-5 sm:px-5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold tracking-tight text-white">
                        {coleta.pontos?.nome ?? "Ponto"}
                      </p>
                      {pendente > 0.009 && (
                        <span className="inline-flex items-center rounded-lg bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-200 ring-1 ring-inset ring-amber-300/30">
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-400">{formatDateTime(coleta.created_at)}</p>
                    <p className="text-[11px] text-slate-500">
                      {coleta.quantidade_furos ?? 0} furos
                      <span className="mx-1.5 text-slate-700">·</span>
                      <span className="capitalize">{coleta.forma_pagamento ?? "—"}</span>
                      <span className="mx-1.5 text-slate-700">·</span>
                      Bruto {formatCurrency(Number(coleta.valor_bruto ?? 0))}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums tracking-tight text-emerald-300 sm:text-xl">
                        {formatCurrency(lucro)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        lucro real
                      </p>
                      {aReceber > 0.009 && (
                        <p className="mt-1.5 text-xs font-medium tabular-nums text-cyan-300">
                          cobrado {formatCurrency(cobrado)}
                        </p>
                      )}
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-slate-500 transition group-hover:bg-cyan-400/10 group-hover:text-cyan-300">
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FuraFuraColetasClient({ coletas }: { coletas: ColetaFuraListItem[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px]">
      <FuraFuraColetasLista coletas={coletas} />
      <FuraFuraPendentesPanel coletas={coletas} />
    </div>
  );
}
