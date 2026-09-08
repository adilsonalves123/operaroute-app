"use client";

import { useRouter } from "next/navigation";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { formatCurrency, formatDate } from "@/lib/utils";

export type VisaoPainelPonto = {
  id: string;
  nome: string;
  valor: number | null;
};

type Props = {
  dataISO: string;
  hojeISO: string;
  pontos: VisaoPainelPonto[];
  total: number;
  nomeOperador?: string | null;
  datasComValor?: string[];
};

export function VisaoPainelClient({
  dataISO,
  hojeISO,
  pontos,
  total,
  nomeOperador,
  datasComValor = [],
}: Props) {
  const router = useRouter();
  const temValorNoDia = pontos.some((p) => p.valor != null);

  function irParaDia(data: string) {
    if (!data) return;
    router.push(data === hojeISO ? "/dashboard" : `/dashboard?data=${data}`);
  }

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
      </header>

      <div className="space-y-3 rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block min-w-[12rem] flex-1">
            <span className="text-sm text-at-muted">Valores do dia</span>
            <input
              type="date"
              value={dataISO}
              max={hojeISO}
              onChange={(e) => irParaDia(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2 text-sm text-at-primary"
            />
          </label>
          <p className="text-xl font-semibold tabular-nums text-emerald-500">
            {formatCurrency(total)}
          </p>
        </div>
        <p className="text-sm text-at-muted">{formatDate(`${dataISO}T12:00:00`)}</p>
        {dataISO !== hojeISO && (
          <button
            type="button"
            onClick={() => irParaDia(hojeISO)}
            className="text-sm text-[var(--shell-accent)] underline-offset-2 hover:underline"
          >
            Voltar para hoje
          </button>
        )}
        {datasComValor.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {datasComValor.slice(0, 10).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => irParaDia(d)}
                className={
                  d === dataISO
                    ? "rounded-full bg-[var(--shell-tab-active-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--shell-tab-active-text)]"
                    : "rounded-full border border-[var(--shell-border)] px-2.5 py-1 text-[11px] text-at-muted hover:text-at-primary"
                }
              >
                {formatDate(`${d}T12:00:00`)}
              </button>
            ))}
          </div>
        )}
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

      {pontos.length > 0 && !temValorNoDia && (
        <p className="text-sm text-at-muted">
          Não há valores gravados neste dia. Escolha outra data ou peça ao administrador para
          publicar o rascunho daquele dia.
        </p>
      )}
    </div>
  );
}
