"use client";

import { useMemo } from "react";
import { PontoForm } from "@/components/pontos/PontoForm";
import { valuesFromPonto, type PontoFormSource } from "@/lib/pontos/form";

type Props = {
  pontoId: string;
  ponto: PontoFormSource;
};

export function EditarPontoForm({ pontoId, ponto }: Props) {
  const initial = useMemo(() => valuesFromPonto(ponto), [ponto]);

  return <PontoForm mode="edit" pontoId={pontoId} initial={initial} />;
}
