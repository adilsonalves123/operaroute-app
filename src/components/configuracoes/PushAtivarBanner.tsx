"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { isNativeAndroidApp } from "@/lib/push/client";

/**
 * Aviso no dashboard: admin/gerente ainda não ativou push neste aparelho.
 */
export function PushAtivarBanner() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/push/subscribe");
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const pode =
          data.allowed &&
          !data.subscribed &&
          (data.configured || isNativeAndroidApp());
        if (pode) setMostrar(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mostrar) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/15">
          <Bell className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Ative os alertas push</p>
          <p className="mt-0.5 text-xs text-at-muted leading-relaxed">
            Receba no celular/PC quando o operador fizer coleta, manutencao, equipamento
            arrumado ou suporte.
          </p>
        </div>
      </div>
      <Link
        href="/configuracoes#alertas"
        className="inline-flex shrink-0 items-center rounded-lg bg-cyan-500 px-3.5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
      >
        Ativar agora
      </Link>
    </div>
  );
}
