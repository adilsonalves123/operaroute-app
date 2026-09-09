"use client";

import { useRouter } from "next/navigation";
import { dashboardGreeting } from "@/lib/dashboard-greeting";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export type VisaoPainelPonto = {
  id: string;
  nome: string;
  valor: number | null;
  forma?: string | null;
};

type Props = {
  vista: "dia" | "periodo";
  dataISO: string;
  hojeISO: string;
  deISO: string;
  ateISO: string;
  pontos: VisaoPainelPonto[];
  total: number;
  nomeOperador?: string | null;
  datasComValor?: string[];
};

function formaLabel(forma?: string | null) {
  const f = String(forma ?? "").toLowerCase();
  if (forma === "PIX + DINHEIRO" || f === "misto") return "PIX + DINHEIRO";
  if (f === "pix") return "PIX";
  if (f === "dinheiro") return "DINHEIRO";
  if (!forma) return "";
  return String(forma).toUpperCase();
}

export function VisaoPainelClient({
  vista,
  dataISO,
  hojeISO,
  deISO,
  ateISO,
  pontos,
  total,
  nomeOperador,
  datasComValor = [],
}: Props) {
  const router = useRouter();
  const ranking = pontos
    .filter((p) => p.valor != null && Math.abs(p.valor) > 0.0001)
    .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
  const maxAbs = Math.max(...ranking.map((p) => Math.abs(p.valor ?? 0)), 1);

  function ir(params: Record<string, string>) {
    const q = new URLSearchParams(params);
    router.push(`/dashboard?${q.toString()}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-4">
      <header className="space-y-2">
        <h1
          className="text-3xl font-semibold tracking-tight text-at-primary"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {dashboardGreeting(nomeOperador)}
        </h1>
        <p className="text-sm text-at-muted">
          Só o que foi enviado para você. Os valores ficam salvos neste painel.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] px-4 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => ir({ data: dataISO })}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              vista === "dia"
                ? "bg-[var(--shell-tab-active-bg)] text-[var(--shell-tab-active-text)]"
                : "border border-[var(--shell-border)] text-at-muted"
            )}
          >
            Dia
          </button>
          <button
            type="button"
            onClick={() => ir({ vista: "periodo", de: deISO, ate: ateISO })}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              vista === "periodo"
                ? "bg-[var(--shell-tab-active-bg)] text-[var(--shell-tab-active-text)]"
                : "border border-[var(--shell-border)] text-at-muted"
            )}
          >
            Período
          </button>
        </div>

        {vista === "dia" ? (
          <label className="block">
            <span className="text-sm text-at-muted">Valores do dia</span>
            <input
              type="date"
              value={dataISO}
              max={hojeISO}
              onChange={(e) => ir({ data: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2 text-sm text-at-primary"
            />
          </label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-at-muted">De</span>
              <input
                type="date"
                value={deISO}
                max={ateISO}
                onChange={(e) => ir({ vista: "periodo", de: e.target.value, ate: ateISO })}
                className="mt-1.5 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2 text-sm text-at-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm text-at-muted">Até</span>
              <input
                type="date"
                value={ateISO}
                min={deISO}
                max={hojeISO}
                onChange={(e) => ir({ vista: "periodo", de: deISO, ate: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 py-2 text-sm text-at-primary"
              />
            </label>
          </div>
        )}

        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-at-muted">
            {vista === "dia"
              ? formatDate(`${dataISO}T12:00:00`)
              : `${formatDate(`${deISO}T12:00:00`)} — ${formatDate(`${ateISO}T12:00:00`)}`}
          </p>
          <p
            className="text-2xl tabular-nums text-[var(--shell-text)]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      {ranking.length === 0 ? (
        <p className="text-sm text-at-muted">
          Não há valores gravados {vista === "dia" ? "neste dia" : "neste período"}. Peça para
          enviar o rascunho de novo.
        </p>
      ) : (
        <section className="space-y-5">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.2em] text-at-muted">
            Por ponto
          </h2>
          <ol className="space-y-4">
            {ranking.map((p, i) => {
              const valor = p.valor ?? 0;
              const width = Math.max(6, (Math.abs(valor) / maxAbs) * 100);
              const forma = formaLabel(p.forma);
              return (
                <li key={p.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-[16px] text-at-primary">
                      <span className="mr-2 tabular-nums text-at-muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {p.nome}
                      {forma ? (
                        <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-at-muted">
                          {forma}
                        </span>
                      ) : null}
                    </p>
                    <p
                      className={cn(
                        "shrink-0 text-[15px] tabular-nums",
                        valor < 0 ? "text-rose-400" : "text-at-primary"
                      )}
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {formatCurrency(valor)}
                    </p>
                  </div>
                  <div className="h-[3px] w-full overflow-hidden bg-[var(--shell-border)]">
                    <div
                      className={cn(
                        "h-full",
                        valor < 0 ? "bg-rose-400/60" : "bg-[#c4a574]"
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {vista === "dia" && datasComValor.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {datasComValor.slice(0, 12).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => ir({ data: d })}
              className={
                d === dataISO
                  ? "rounded-full bg-[var(--shell-tab-active-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--shell-tab-active-text)]"
                  : "rounded-full border border-[var(--shell-border)] px-2.5 py-1 text-[11px] text-at-muted"
              }
            >
              {formatDate(`${d}T12:00:00`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
