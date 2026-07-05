"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Coleta } from "@/lib/types/database";
import { Package } from "lucide-react";

type ColetaWithPonto = Coleta & {
  pontos?: { nome: string; cidade: string | null } | null;
};

export function ColetasClient({ coletas }: { coletas: ColetaWithPonto[] }) {
  if (coletas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma coleta registrada"
        description="Nenhuma coleta registrada ainda. Faça sua primeira coleta para ver seus resultados."
        actionLabel="Nova coleta"
        actionHref="/coletas/nova"
        icon={<Package className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      {coletas.map((coleta) => (
        <div key={coleta.id} className="glass-card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">{coleta.pontos?.nome ?? "Ponto"}</p>
            <p className="text-sm text-slate-400">{formatDateTime(coleta.created_at)}</p>
            {coleta.observacao && (
              <p className="text-xs text-slate-500 mt-1 truncate max-w-xs">{coleta.observacao}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-green-400">{formatCurrency(Number(coleta.valor_liquido))}</p>
            <AlertBadge variant="info" className="mt-1">{coleta.forma_pagamento}</AlertBadge>
          </div>
        </div>
      ))}
    </div>
  );
}
