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
            Valores publicados para você. A leitura na rua continua no botão abaixo.
          </p>
        </div>
        <Link href={novaHref} className={coletaBtnSubmitClass("shrink-0 rounded-2xl px-5 py-3")}>
          <Plus className="h-4 w-4 transition group-hover:rotate-90" />
          Nova leitura
        </Link>
      </header>

      {linhas.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
          Ainda não há valores publicados. Faça a coleta normalmente; o administrador publica o
          que aparece aqui.
        </p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((l) => (
            <li
              key={`${l.ponto_id}-${l.data}`}
              className="flex items-baseline justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div>
                <p className="text-sm text-slate-100">{l.pontoNome}</p>
                <p className="text-xs text-slate-500">{formatDate(`${l.data}T12:00:00`)}</p>
              </div>
              <span className="tabular-nums text-sm font-medium text-emerald-300">
                {formatCurrency(l.valor_exibido)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
