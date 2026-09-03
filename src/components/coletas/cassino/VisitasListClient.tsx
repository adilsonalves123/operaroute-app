"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { centesimosToReais } from "@/lib/nichos/cassino";
import { Package, ChevronRight } from "lucide-react";

export interface VisitaListItem {
  id: string;
  created_at: string;
  total_lucro_centavos: number;
  valor_operacao_efetivo: number;
  valor_pago: number;
  restante: number;
  saldo_negativo: boolean;
  forma_pagamento: string;
  relatorio_url: string | null;
  pontos: { nome: string; cidade: string | null } | null;
  maquinas_count: number;
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "danger" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
        tone === "danger" && "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30",
        tone === "warning" && "bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-300/30"
      )}
    >
      {children}
    </span>
  );
}

export function VisitasListClient({ visitas }: { visitas: VisitaListItem[] }) {
  if (visitas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma visita registrada"
        description="Faça sua primeira leitura cassino para ver o histórico aqui."
        actionLabel="Nova leitura"
        actionHref="/coletas/nova/cassino"
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
          {visitas.length} visita{visitas.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ul className="space-y-2.5">
        {visitas.map((visita) => {
          const negativo = visita.saldo_negativo;
          const pendente = visita.restante > 0.009 && !negativo;
          const lucro = centesimosToReais(Number(visita.total_lucro_centavos));

          return (
            <li key={visita.id}>
              <Link
                href={`/coletas/visita/${visita.id}`}
                className={cn(
                  "group relative flex items-stretch overflow-hidden rounded-2xl border border-white/[0.07]",
                  "bg-[#0c1018]/90",
                  "transition duration-200 hover:-translate-y-0.5 hover:border-[#c4a574]/25 hover:shadow-[0_18px_40px_-28px_rgba(196,165,116,0.45)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a574]/40"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-1 shrink-0",
                    negativo ? "bg-rose-400" : pendente ? "bg-amber-400" : "bg-emerald-400/80"
                  )}
                />

                <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 sm:gap-5 sm:px-5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold tracking-tight text-white">
                        {visita.pontos?.nome ?? "Ponto"}
                      </p>
                      {negativo && <StatusChip tone="danger">Negativo</StatusChip>}
                      {pendente && <StatusChip tone="warning">Pendente</StatusChip>}
                    </div>
                    <p className="text-[13px] text-slate-400">{formatDateTime(visita.created_at)}</p>
                    <p className="text-[11px] text-slate-500">
                      {visita.maquinas_count} máquina
                      {visita.maquinas_count !== 1 ? "s" : ""}
                      <span className="mx-1.5 text-slate-700">·</span>
                      <span className="capitalize">{visita.forma_pagamento}</span>
                      {visita.pontos?.cidade ? (
                        <>
                          <span className="mx-1.5 text-slate-700">·</span>
                          {visita.pontos.cidade}
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-semibold tabular-nums tracking-tight sm:text-xl",
                          negativo ? "text-rose-300" : "text-emerald-300"
                        )}
                      >
                        {formatCurrency(lucro)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        lucro bruto
                      </p>
                      {!negativo && (
                        <p className="mt-1.5 text-xs font-medium tabular-nums text-cyan-300">
                          cobrado {formatCurrency(Number(visita.valor_pago))}
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
