"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import {
  isNativeAndroidApp,
  pushSupported,
  subscribeWebPush,
  unsubscribeWebPush,
} from "@/lib/push/client";
import { cn } from "@/lib/utils";

type Status = {
  configured: boolean;
  fcmConfigured?: boolean;
  allowed: boolean;
  subscribed: boolean;
};

export function PushNotificacoesCard({ embedded }: { embedded?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const supported = pushSupported();
  const native = isNativeAndroidApp();

  async function refresh() {
    try {
      const res = await fetch("/api/push/subscribe");
      const data = await res.json();
      if (res.ok) {
        setStatus({
          configured: Boolean(data.configured),
          fcmConfigured: Boolean(data.fcmConfigured),
          allowed: Boolean(data.allowed),
          subscribed: Boolean(data.subscribed),
        });
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function ativar() {
    setBusy(true);
    setErro("");
    setMsg("");
    const result = await subscribeWebPush();
    if (!result.ok) {
      setErro(result.error);
    } else {
      setMsg("Alertas ativados neste aparelho.");
      await refresh();
    }
    setBusy(false);
  }

  async function desativar() {
    setBusy(true);
    setErro("");
    setMsg("");
    try {
      await unsubscribeWebPush();
      setMsg("Alertas desativados neste aparelho.");
      await refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao desativar.");
    }
    setBusy(false);
  }

  const podeAtivar = Boolean(status?.configured || native);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-slate-500", !embedded && "p-5")}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando notificações…
      </div>
    );
  }

  if (status && !status.allowed) return null;

  return (
    <div className={cn("space-y-3", !embedded && "p-5 sm:p-6")}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
          <Bell className="h-5 w-5 text-cyan-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">
            {native ? "Alertas push no app Android" : "Alertas push no celular/PC"}
          </p>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed">
            Receba aviso quando o operador registrar coleta (com valor), abrir manutenção,
            marcar equipamento arrumado ou enviar mensagem no suporte.
          </p>
        </div>
      </div>

      {!supported && (
        <p className="text-sm text-amber-300/90">
          Este navegador nao suporta Web Push. Use Chrome/Edge no Android ou no computador
          (HTTPS), ou o app OperaRoute.
        </p>
      )}

      {status && !status.configured && !native && (
        <p className="text-sm text-amber-300/90">
          Push ainda nao esta configurado no servidor (chaves VAPID). Peca ao responsavel
          tecnico para gerar as chaves e colocar no Vercel.
        </p>
      )}

      {native && status && !status.fcmConfigured && (
        <p className="text-sm text-amber-300/90">
          Voce pode ativar neste aparelho. Para o servidor enviar o alerta, falta configurar
          Firebase (FIREBASE_SERVICE_ACCOUNT_JSON) no Vercel.
        </p>
      )}

      {erro && <p className="text-sm text-red-400">{erro}</p>}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        {status?.subscribed ? (
          <button
            type="button"
            disabled={busy || !supported}
            onClick={() => void desativar()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
            Desativar neste aparelho
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !supported || !podeAtivar}
            onClick={() => void ativar()}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Ativar alertas
          </button>
        )}
      </div>
    </div>
  );
}
