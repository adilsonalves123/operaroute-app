"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import { COOKIE_SIMULAR_TRIAL } from "@/lib/assinatura-simulacao";

function setCookieSimular(modo: "expirado" | "off") {
  if (modo === "off") {
    document.cookie = `${COOKIE_SIMULAR_TRIAL}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${COOKIE_SIMULAR_TRIAL}=expirado; path=/; max-age=${60 * 60 * 4}; SameSite=Lax`;
}

/** Liga/desliga pré-visualização do trial encerrado + repara banner na conta. */
export function SimularTrialButton() {
  const [loading, setLoading] = useState<"simular" | "reparar" | null>(null);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function simularExpirado() {
    setError("");
    setOkMsg("");
    setLoading("simular");
    try {
      const res = await fetch("/api/empresa/simular-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "expirado" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível iniciar a simulação.");
        return;
      }
      // Cookie também no client + reload completo (layout server lê o cookie)
      setCookieSimular("expirado");
      window.location.assign("/dashboard");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(null);
    }
  }

  async function repararTrial() {
    setError("");
    setOkMsg("");
    setLoading("reparar");
    try {
      setCookieSimular("off");
      await fetch("/api/empresa/simular-trial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "off" }),
      }).catch(() => null);

      const res = await fetch("/api/empresa/reparar-trial", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível reparar o trial.");
        return;
      }
      setOkMsg("Trial de 7 dias reativado. Recarregando…");
      window.location.assign("/dashboard");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <RotateCcw className="h-5 w-5 text-primary-neon shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-white">Banner de 7 dias não aparece?</p>
          <p className="text-sm text-slate-400 mt-1">
            Contas antigas ficaram marcadas como “assinatura ativa” por engano.
            Isso esconde o banner e impede o bloqueio ao fim do teste. Use o botão
            abaixo para corrigir e recomeçar os 7 dias.
          </p>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void repararTrial()}
            className="mt-3 rounded-xl bg-primary-neon px-4 py-2.5 text-sm font-semibold text-slate-900 hover:brightness-110 disabled:opacity-60 transition"
          >
            {loading === "reparar" ? "Corrigindo…" : "Reativar 7 dias grátis nesta conta"}
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 flex items-start gap-3">
        <FlaskConical className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-white">Simular fim do teste grátis</p>
          <p className="text-sm text-slate-400 mt-1">
            Mostra a tela de bloqueio como se os 7 dias tivessem acabado — sem
            alterar o banco. Barra amarela no topo para sair.
          </p>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void simularExpirado()}
            className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-60 transition"
          >
            {loading === "simular" ? "Abrindo…" : "Ver tela de trial encerrado"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="text-sm text-primary-neon" role="status">
          {okMsg}
        </p>
      )}
    </div>
  );
}
