"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export type VisitaPontoHistoricoRow = {
  id: string;
  created_at: string;
  finalizada_em: string | null;
  status: string;
  subtotal_cobravel: number | null;
  total_cobrado: number | null;
  valor_pago: number | null;
  restante: number | null;
};

export function PontoHistoricoVisitas({ visitas }: { visitas: VisitaPontoHistoricoRow[] }) {
  const [aberto, setAberto] = useState(false);
  const total = visitas.length;

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left transition hover:bg-white/[0.02] -mx-1 px-1"
      >
        <div className="min-w-0">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-at-muted">
            Linha do tempo
          </h2>
          <p className="mt-1 text-[15px] text-white">Visitas neste ponto</p>
          {!aberto && (
            <p className="mt-0.5 text-[12px] text-at-muted">
              {total === 0
                ? "Nenhuma visita ainda"
                : `${total} ${total === 1 ? "visita" : "visitas"} · toque para expandir`}
            </p>
          )}
        </div>
        {aberto ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-at-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-at-muted" />
        )}
      </button>

      {aberto && (
        <>
          {!visitas.length ? (
            <p className="text-[13px] text-at-muted">
              Nenhuma visita multi-nicho finalizada ainda.
            </p>
          ) : (
            <ol className="relative space-y-0 border-l border-at-soft pl-5">
              {visitas.map((v) => {
                const data = v.finalizada_em ?? v.created_at;
                const totalVisita = Number(v.total_cobrado ?? v.subtotal_cobravel ?? 0);
                const recebido = Number(v.valor_pago ?? 0);
                const pendente = Number(v.restante ?? 0);
                return (
                  <li key={v.id} className="relative pb-6 last:pb-0">
                    <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border border-slate-950 bg-slate-400" />
                    <Link
                      href={`/visitas-ponto/${v.id}/resumo`}
                      className="group block rounded-xl py-1 transition hover:bg-white/[0.02]"
                    >
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-[13px] text-at-muted">
                          {formatDateTime(data)}
                        </p>
                        <p className="text-[15px] font-semibold tabular-nums tracking-tight text-white group-hover:text-sky-200">
                          {formatCurrency(totalVisita)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[12px] text-at-muted">
                        {pendente > 0.009
                          ? `Pendente ${formatCurrency(pendente)}`
                          : recebido > 0.009
                            ? `Recebido ${formatCurrency(recebido)}`
                            : "Sem pagamento"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
