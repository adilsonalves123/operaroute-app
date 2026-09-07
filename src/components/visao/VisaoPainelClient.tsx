"use client";

import { formatCurrency, formatDate } from "@/lib/utils";

export type VisaoPainelPonto = {
  id: string;
  nome: string;
  valor: number | null;
};

type Props = {
  dataISO: string;
  pontos: VisaoPainelPonto[];
  total: number;
};

export function VisaoPainelClient({ dataISO, pontos, total }: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-at-link/80">
          Seu painel
        </p>
        <h1
          className="mt-1.5 text-3xl font-semibold tracking-tight text-at-primary"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Pontos liberados
        </h1>
        <p className="mt-1.5 text-sm text-at-muted">
          Valores do dia {formatDate(`${dataISO}T12:00:00`)} publicados para você. A coleta na rua
          continua normal.
        </p>
      </header>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-400">Total publicado</span>
        <span className="text-xl font-semibold tabular-nums text-emerald-300">
          {formatCurrency(total)}
        </span>
      </div>

      {pontos.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
          Nenhum ponto liberado ainda. Peça ao administrador para marcar seus pontos na Equipe.
        </p>
      ) : (
        <ul className="space-y-2">
          {pontos.map((p) => (
            <li
              key={p.id}
              className="flex items-baseline justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <span className="text-sm text-slate-200">{p.nome}</span>
              <span className="tabular-nums text-sm text-slate-100">
                {p.valor == null ? "—" : formatCurrency(p.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
