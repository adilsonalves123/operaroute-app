"use client";

import { ExcluirColetaNichoButton } from "@/components/coletas/ExcluirColetaNichoButton";

export function ExcluirColetaFuraFuraButton({ coletaId }: { coletaId: string }) {
  return (
    <ExcluirColetaNichoButton
      coletaId={coletaId}
      apiPath={`/api/coletas/fura-fura/${coletaId}`}
      confirmMessage="Excluir esta coleta? Isso remove lançamentos financeiros, pendências e restaura furos/brindes no ponto."
    />
  );
}
