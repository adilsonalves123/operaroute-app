"use client";

import { useEffect, useState } from "react";
import { NICHO_CARD_VISUAL, NICHO_CARDS_EXIBICAO, NICHOS } from "@/lib/nicho";
import type { Nicho } from "@/lib/types/database";

function coversPadrao(): Record<Nicho, string> {
  const out = {} as Record<Nicho, string>;
  for (const id of Object.keys(NICHO_CARD_VISUAL) as Nicho[]) {
    out[id] = NICHO_CARD_VISUAL[id].coverImage;
  }
  return out;
}

export type NichoCatalogState = {
  covers: Record<Nicho, string>;
  labels: Partial<Record<Nicho, string>>;
  descricoes: Partial<Record<Nicho, string>>;
  /** Nichos visíveis no carrossel do app (não pausados). */
  ativos: Nicho[];
  pausados: Nicho[];
  ready: boolean;
};

const INITIAL: NichoCatalogState = {
  covers: coversPadrao(),
  labels: {},
  descricoes: {},
  ativos: [...NICHO_CARDS_EXIBICAO],
  pausados: [],
  ready: false,
};

/** Catálogo de cards de nicho (foto, texto, pausados). */
export function useNichoCatalog(): NichoCatalogState {
  const [state, setState] = useState<NichoCatalogState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/nichos/covers")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setState({
          covers: d?.covers ?? coversPadrao(),
          labels: d?.labels ?? {},
          descricoes: d?.descricoes ?? {},
          ativos: Array.isArray(d?.ativos) ? d.ativos : [...NICHO_CARDS_EXIBICAO],
          pausados: Array.isArray(d?.pausados) ? d.pausados : [],
          ready: true,
        });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, ready: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** @deprecated use useNichoCatalog().covers */
export function useNichoCovers() {
  return useNichoCatalog().covers;
}

export function labelNichoCatalog(
  catalog: NichoCatalogState,
  nicho: Nicho
): string {
  return catalog.labels[nicho] || NICHOS[nicho]?.label || nicho;
}

export function descNichoCatalog(
  catalog: NichoCatalogState,
  nicho: Nicho
): string {
  return catalog.descricoes[nicho] || NICHO_CARD_VISUAL[nicho]?.cardDescription || "";
}
