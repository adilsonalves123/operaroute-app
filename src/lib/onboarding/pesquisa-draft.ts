import type { Nicho } from "@/lib/types/database";

export const PESQUISA_DRAFT_KEY = "or_onboarding_pesquisa";

export type PesquisaDraft = {
  quantidade_pontos: "1-10" | "11-50" | "51-100";
  nichos: Nicho[];
  possui_funcionarios: boolean;
  savedAt: number;
};

export function savePesquisaDraft(draft: Omit<PesquisaDraft, "savedAt">) {
  const payload: PesquisaDraft = { ...draft, savedAt: Date.now() };
  try {
    sessionStorage.setItem(PESQUISA_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadPesquisaDraft(): PesquisaDraft | null {
  try {
    const raw = sessionStorage.getItem(PESQUISA_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PesquisaDraft;
    if (!data?.quantidade_pontos || !Array.isArray(data.nichos)) return null;
    if (typeof data.possui_funcionarios !== "boolean") return null;
    if (data.nichos.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearPesquisaDraft() {
  try {
    sessionStorage.removeItem(PESQUISA_DRAFT_KEY);
  } catch {
    // ignore
  }
}
