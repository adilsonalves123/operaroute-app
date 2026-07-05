"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura";
import type { Coleta } from "@/lib/types/database";
import { Package, AlertTriangle } from "lucide-react";

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
    <aside className="glass-card p-5 space-y-4 h-fit lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Pendências</h2>
        {totalGeral > 0.009 && (
          <span className="text-sm font-bold text-amber-400 tabular-nums">
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
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 hover:border-amber-500/25 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.pontoNome}</p>
                  <p className="text-xs text-slate-500">
                    {item.coletasAbertas} em aberto
                  </p>
                </div>
                <p className="text-sm font-semibold text-amber-400 tabular-nums shrink-0">
                  {formatCurrency(item.total)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/coletas/pendentes"
        className="flex items-center justify-center gap-2 w-full rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800/50 transition"
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
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-slate-400">Histórico</h2>
      {coletas.map((coleta) => {
        const pendente = saldoPendenteColeta(coleta);
        const lucro = Number(coleta.lucro_real ?? coleta.valor_liquido ?? 0);
        const cobrado = Number(coleta.valor_pago_recebido ?? 0);
        const aReceber = Number(coleta.valor_a_receber ?? coleta.valor_liquido ?? 0);

        return (
          <Link
            key={coleta.id}
            href={`/coletas/fura-fura/${coleta.id}`}
            className="glass-card p-4 flex items-center justify-between gap-4 hover:border-primary-neon/20 transition block"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-white">{coleta.pontos?.nome ?? "Ponto"}</p>
                {pendente > 0.009 && <AlertBadge variant="warning">Pendente</AlertBadge>}
              </div>
              <p className="text-sm text-slate-400">{formatDateTime(coleta.created_at)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {coleta.quantidade_furos ?? 0} furos · {coleta.forma_pagamento ?? "—"} · Bruto{" "}
                {formatCurrency(Number(coleta.valor_bruto ?? 0))}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div>
                <p className="font-semibold text-green-400 tabular-nums">
                  {formatCurrency(lucro)}
                </p>
                <p className="text-xs text-slate-500">lucro real</p>
                {aReceber > 0.009 && (
                  <p className="text-xs text-primary-neon mt-0.5">
                    cobrado {formatCurrency(cobrado)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
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
