"use client";

import { useEffect } from "react";

const KEY = "or_auditoria_sessao";

/**
 * Registra entrada no app uma vez por aba/sessão do browser.
 * Coloque dentro do AppShell (usuário autenticado).
 */
export function AuditoriaSessaoBeacon() {
  useEffect(() => {
    let cancelled = false;

    async function registrar() {
      try {
        const existing = sessionStorage.getItem(KEY);
        if (existing) {
          await fetch("/api/auditoria/sessao", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evento: "ping", sessao_id: existing }),
          });
          return;
        }

        const res = await fetch("/api/auditoria/sessao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evento: "login" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.sessao_id) {
          sessionStorage.setItem(KEY, data.sessao_id);
        }
      } catch {
        // silencioso
      }
    }

    void registrar();

    const onUnload = () => {
      const id = sessionStorage.getItem(KEY);
      if (!id) return;
      try {
        navigator.sendBeacon?.(
          "/api/auditoria/sessao",
          new Blob(
            [JSON.stringify({ evento: "logout", sessao_id: id })],
            { type: "application/json" }
          )
        );
      } catch {
        // ignore
      }
    };

    window.addEventListener("pagehide", onUnload);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onUnload);
    };
  }, []);

  return null;
}
