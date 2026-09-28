"use client";

import { useRef } from "react";

/**
 * Código único da coleta em andamento. Repetir o envio (clique duplo, sinal
 * caindo no meio) reaproveita o mesmo código — o servidor não lança duas vezes.
 */
export function useEnvioId() {
  const ref = useRef<string | null>(null);
  return {
    atual(): string {
      if (!ref.current) ref.current = crypto.randomUUID();
      return ref.current;
    },
    renovar() {
      ref.current = null;
    },
  };
}
