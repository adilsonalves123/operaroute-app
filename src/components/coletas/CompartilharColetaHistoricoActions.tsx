"use client";

import { CompartilharComprovanteLinkActions } from "@/components/comprovantes/CompartilharComprovanteLinkActions";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";

/** Ações de link mágico no histórico de coleta (todos os nichos). */
export function CompartilharColetaHistoricoActions({
  snapshot,
  telefone,
  visitaId,
}: {
  snapshot: ComprovanteSnapshot;
  telefone?: string | null;
  visitaId?: string | null;
}) {
  return (
    <CompartilharComprovanteLinkActions
      snapshot={snapshot}
      telefone={telefone}
      visitaId={visitaId}
      whatsappLabel="WhatsApp · link"
      shareLabel="Compartilhar"
    />
  );
}
