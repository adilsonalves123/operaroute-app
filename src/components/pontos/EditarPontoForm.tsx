"use client";

import { useMemo } from "react";
import { PontoForm } from "@/components/pontos/PontoForm";
import { valuesFromPonto, type PontoFormSource } from "@/lib/pontos/form";
import type { Nicho } from "@/lib/types/database";

type Props = {
  pontoId: string;
  ponto: PontoFormSource;
  nichosAtivos?: Nicho[];
};

export function EditarPontoForm({ pontoId, ponto, nichosAtivos }: Props) {
  const initial = useMemo(() => valuesFromPonto(ponto, nichosAtivos), [ponto, nichosAtivos]);

  return (
    <PontoForm
      mode="edit"
      pontoId={pontoId}
      initial={initial}
      fotoUrlInicial={ponto.foto_url ?? null}
      nichosAtivos={nichosAtivos}
    />
  );
}
