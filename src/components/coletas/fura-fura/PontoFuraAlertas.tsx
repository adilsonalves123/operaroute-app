"use client";

import { AlertBadge } from "@/components/ui/AlertBadge";
import { alertasPontoFura, type AlertaPontoFura } from "@/lib/nichos/fura-fura";
import type { Ponto } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type Props = {
  ponto: Pick<Ponto, "ultima_coleta" | "furos_estoque" | "furos_minimo" | "nome">;
  className?: string;
};

const variantMap: Record<AlertaPontoFura["tipo"], "warning" | "danger" | "info"> = {
  warning: "warning",
  danger: "danger",
  info: "info",
};

export function PontoFuraAlertas({ ponto, className }: Props) {
  const alertas = alertasPontoFura(ponto);
  if (alertas.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {alertas.map((a) => (
        <AlertBadge key={a.id} variant={variantMap[a.tipo]}>
          {a.mensagem}
        </AlertBadge>
      ))}
    </div>
  );
}
