"use client";

import { dashboardGreeting } from "@/lib/dashboard-greeting";
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
  nomeOperador?: string | null;
};

export function VisaoPainelClient({ dataISO, pontos, total, nomeOperador }: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      <header>
        <h1
          className="text-3xl font-semibold tracking-tight text-at-primary"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {dashboardGreeting(nomeOperador)}
        </h1>
        <h2 className="mt-3 text-lg font-semibold text-at-primary">Pontos da operação</h2>
        <p className="mt-1 text-sm text-at-muted">
          Valores do dia · {formatDate(`${dataISO}T12:00:00`)}
        </p>
      </header>

      <div className="flex items-baseline justify-between gap-3 rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] px-4 py-3">
        <span className="text-sm text-at-muted">Valores do dia</span>
        <span className="text-xl font-semibold tabular-nums text-emerald-500">
          {formatCurrency(total)}
        </span>
      </div>

      {pontos.length === 0 ? (
        <p className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] p-4 text-sm text-at-muted">
          Nenhum ponto da operação ainda. Peça ao administrador para marcar seus pontos na Equipe.
        </p>
      ) : (
        <ul className="space-y-2">
          {pontos.map((p) => (
            <li
              key={p.id}
              className="flex items-baseline justify-between gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] px-4 py-3"
            >
              <span className="text-sm text-at-primary">{p.nome}</span>
              <span className="tabular-nums text-sm text-at-primary">
                {p.valor == null ? "—" : formatCurrency(p.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
