/** Nomes únicos na UI. Internamente parcial e pagamento_pendente continuam iguais. */

export function labelTipoPendencia(tipo?: string | null): string {
  const t = (tipo ?? "").toLowerCase();
  if (t === "parcial" || t === "pagamento_pendente") return "Pagamento parcial";
  if (t === "negativo") return "Mandou sem leitura";
  if (t === "haver") return "Haver do ponto";
  if (t === "visita_consolidada") return "Visita ao ponto";
  return "Pendência";
}

/** Opções do seletor de tipo (nomes só — sem sufixo). `parcial` = `pagamento_pendente`. */
export const OPCOES_TIPO_PENDENCIA = [
  { value: "pagamento_pendente", label: labelTipoPendencia("pagamento_pendente") },
  { value: "negativo", label: labelTipoPendencia("negativo") },
  { value: "haver", label: labelTipoPendencia("haver") },
] as const;

export function isTipoPagamentoParcial(tipo?: string | null): boolean {
  const t = (tipo ?? "").toLowerCase();
  return t === "parcial" || t === "pagamento_pendente";
}
