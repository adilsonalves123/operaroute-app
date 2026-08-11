"use client";

import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { ResumoPendenciaPonto } from "@/lib/nichos/fura-fura/pendencia-ponto";
import { ColetaStatusFaixa } from "@/components/coletas/ColetaHaverPendenciaPanel";

type Props = {
  pontoId: string;
  pontoNome: string;
  pendencia: ResumoPendenciaPonto | null | undefined;
  className?: string;
};

export function PontoDeveFuraAlerta({ pontoId, pontoNome, pendencia, className }: Props) {
  if (!pendencia || pendencia.totalPendente <= 0.009) return null;

  return (
    <ColetaStatusFaixa
      tom="pendencia"
      titulo={`Pendência do ponto · ${pontoNome}`}
      valor={formatCurrency(pendencia.totalPendente)}
      icon={<Clock className="h-4 w-4" />}
      descricao={
        <>
          {pendencia.coletasAbertas} em aberto — ao receber o total sugerido, a dívida é quitada.
          Use Pendências só para receber depois, sem nova coleta.
        </>
      }
      className={className}
    >
      <Link
        href={`/coletas/pendentes?ponto=${pontoId}`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1.5 text-[12px] font-medium text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/30"
      >
        Registrar recebimento da dívida
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </ColetaStatusFaixa>
  );
}
