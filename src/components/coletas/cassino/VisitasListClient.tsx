"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
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
    <div className="space-y-3">
      {visitas.map((visita) => (
        <Link
          key={visita.id}
          href={`/coletas/visita/${visita.id}`}
          className="glass-card p-4 flex items-center justify-between gap-4 hover:border-primary-neon/30 transition"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-white">{visita.pontos?.nome ?? "Ponto"}</p>
              {visita.saldo_negativo && (
                <AlertBadge variant="danger">Negativo</AlertBadge>
              )}
              {visita.restante > 0.009 && !visita.saldo_negativo && (
                <AlertBadge variant="warning">Pendente</AlertBadge>
              )}
            </div>
            <p className="text-sm text-slate-400">{formatDateTime(visita.created_at)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {visita.maquinas_count} máquina{visita.maquinas_count !== 1 ? "s" : ""} ·{" "}
              {visita.forma_pagamento}
            </p>
          </div>
          <div className="text-right shrink-0 flex items-center gap-2">
            <div>
              <p
                className={`font-semibold ${
                  visita.saldo_negativo ? "text-red-400" : "text-green-400"
                }`}
              >
                {formatCurrency(centesimosToReais(Number(visita.total_lucro_centavos)))}
              </p>
              <p className="text-xs text-slate-500">lucro bruto</p>
              {!visita.saldo_negativo && (
                <p className="text-xs text-primary-neon mt-0.5">
                  cobrado {formatCurrency(Number(visita.valor_pago))}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </div>
        </Link>
      ))}
    </div>
  );
}
