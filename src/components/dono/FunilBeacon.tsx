"use client";

import { useEffect } from "react";

type FunilTipo =
  | "visita_login"
  | "visita_cadastro"
  | "visita_landing"
  | "click_cadastro";

/** Dispara uma vez por página (sessionStorage) para contar visitas no painel do dono. */
export function FunilBeacon({ tipo }: { tipo: FunilTipo }) {
  useEffect(() => {
    const key = `or_funil_${tipo}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // continua mesmo sem sessionStorage
    }

    void fetch("/api/publico/funil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        path: window.location.pathname,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [tipo]);

  return null;
}
