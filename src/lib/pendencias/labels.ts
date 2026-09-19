/** Nomes únicos na UI. Internamente parcial e pagamento_pendente continuam iguais. */

export function labelTipoPendencia(tipo?: string | null): string {
  const t = (tipo ?? "").toLowerCase();
  if (t === "parcial" || t === "pagamento_pendente") return "Pagamento parcial";
  if (t === "negativo") return "Mandou sem leitura";
  if (t === "haver") return "Haver do ponto";
  if (t === "visita_consolidada") return "Visita ao ponto";
  return "Pendência";
}

export function isTipoPagamentoParcial(tipo?: string | null): boolean {
  const t = (tipo ?? "").toLowerCase();
  return t === "parcial" || t === "pagamento_pendente";
}
