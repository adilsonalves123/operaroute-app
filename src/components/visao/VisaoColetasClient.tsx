"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { coletaBtnSubmitClass } from "@/components/coletas/layout/coleta-form-styles";

export type VisaoColetaLinha = {
  ponto_id: string;
  pontoNome: string;
  data: string;
  valor_exibido: number;
};

type Props = {
  linhas: VisaoColetaLinha[];
  novaHref?: string;
};

export function VisaoColetasClient({ linhas, novaHref = "/coletas/nova" }: Props) {
  const porDia = new Map<string, VisaoColetaLinha[]>();
  for (const l of linhas) {
    const lista = porDia.get(l.data) ?? [];
    lista.push(l);
    porDia.set(l.data, lista);
  }
  const dias = [...porDia.keys()];

  return (
    <div className="relative space-y-7">
      <header className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-at-link/80">
            Operação
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-at-primary sm:text-[2rem]">
            Coletas
          </h1>
          <p className="mt-1.5 text-sm text-at-muted">
            Valores do dia, inclusive dias anteriores. A leitura na rua continua no botão abaixo.
          </p>
        </div>
        <Link href={novaHref} className={coletaBtnSubmitClass("shrink-0 rounded-2xl px-5 py-3")}>
          <Plus className="h-4 w-4 transition group-hover:rotate-90" />
          Nova leitura
        </Link>
      </header>

      {linhas.length === 0 ? (
        <p className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] p-4 text-sm text-at-muted">
          Ainda não há valores do dia gravados. Faça a coleta normalmente; o administrador publica o
          que aparece aqui.
        </p>
      ) : (
        <div className="space-y-6">
          {dias.map((dia) => (
            <section key={dia} className="space-y-2">
              <h2 className="text-sm font-medium text-at-muted">
                {formatDate(`${dia}T12:00:00`)}
              </h2>
              <ul className="space-y-2">
                {(porDia.get(dia) ?? []).map((l) => (
                  <li
                    key={`${l.ponto_id}-${l.data}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-surface-soft)] px-4 py-3"
                  >
                    <p className="text-sm text-at-primary">{l.pontoNome}</p>
                    <span className="tabular-nums text-sm font-medium text-emerald-500">
                      {formatCurrency(l.valor_exibido)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
