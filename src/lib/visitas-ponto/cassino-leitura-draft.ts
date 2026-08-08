/** Rascunho local de leituras cassino ao trocar de nicho antes do 1º Continuar. */

export type LeituraDraft = {
  equipamentoId: string;
  entradaAtualInput: string;
  saidaAtualInput: string;
  fotoUrl: string | null;
};

function draftKey(visitaPontoId: string, pontoId: string) {
  return `or_cassino_draft:${visitaPontoId}:${pontoId}`;
}

export function saveCassinoLeiturasDraft(
  visitaPontoId: string,
  pontoId: string,
  leituras: LeituraDraft[]
) {
  if (typeof window === "undefined" || !visitaPontoId || !pontoId) return;
  try {
    const payload = {
      savedAt: Date.now(),
      leituras: leituras.filter(
        (l) => l.entradaAtualInput || l.saidaAtualInput || l.fotoUrl
      ),
    };
    if (payload.leituras.length === 0) {
      sessionStorage.removeItem(draftKey(visitaPontoId, pontoId));
      return;
    }
    sessionStorage.setItem(draftKey(visitaPontoId, pontoId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function loadCassinoLeiturasDraft(
  visitaPontoId: string,
  pontoId: string
): LeituraDraft[] | null {
  if (typeof window === "undefined" || !visitaPontoId || !pontoId) return null;
  try {
    const raw = sessionStorage.getItem(draftKey(visitaPontoId, pontoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { leituras?: LeituraDraft[] };
    if (!Array.isArray(parsed.leituras) || parsed.leituras.length === 0) return null;
    return parsed.leituras;
  } catch {
    return null;
  }
}

export function clearCassinoLeiturasDraft(visitaPontoId: string, pontoId: string) {
  if (typeof window === "undefined" || !visitaPontoId || !pontoId) return;
  try {
    sessionStorage.removeItem(draftKey(visitaPontoId, pontoId));
  } catch {
    /* ignore */
  }
}
