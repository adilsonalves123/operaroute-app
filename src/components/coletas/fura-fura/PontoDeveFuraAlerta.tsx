"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ResumoPendenciaPonto } from "@/lib/nichos/fura-fura/pendencia-ponto";

type Props = {
  pontoId: string;
  pontoNome: string;
  pendencia: ResumoPendenciaPonto | null | undefined;
  className?: string;
};

export function PontoDeveFuraAlerta({ pontoId, pontoNome, pendencia, className }: Props) {
  if (!pendencia || pendencia.totalPendente <= 0.009) return null;

  return (
    <div
      className={`rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-4 ${className ?? ""}`}
      role="alert"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-amber-200">
              Cliente te deve — {pontoNome}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-400">
              {formatCurrency(pendencia.totalPendente)}
            </p>
            <p className="mt-1 text-xs text-amber-200/70">
              {pendencia.coletasAbertas} coleta{pendencia.coletasAbertas === 1 ? "" : "s"} anterior
              {pendencia.coletasAbertas === 1 ? "" : "es"} sem quitar
            </p>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Se receber o <strong className="text-slate-300">total sugerido</strong> na nova coleta,
            a dívida antiga é quitada automaticamente. Use{" "}
            <strong className="text-slate-300">Pendências</strong> só para receber depois, sem nova
            coleta.
          </p>
          <Link
            href={`/coletas/pendentes?ponto=${pontoId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-neon hover:underline"
          >
            Registrar recebimento da dívida
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
