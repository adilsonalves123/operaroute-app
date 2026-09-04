"use client";

import { ImprimirRelatorioColetaButton } from "@/components/coletas/ImprimirRelatorioColetaButton";
import {
  montarImpressaoOptsCassino,
  type RelatorioColetaData,
} from "@/lib/nichos/cassino/relatorio";

/** Imprime comprovante só texto/números (sem foto) — térmica ou A4. */
export function ImprimirColetaCassinoButton({
  data,
  className,
}: {
  data: RelatorioColetaData;
  className?: string;
}) {
  return (
    <ImprimirRelatorioColetaButton
      className={className}
      getImpressaoOpts={() => montarImpressaoOptsCassino({ ...data, previa: false })}
    />
  );
}
