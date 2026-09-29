"use client";

import { useEffect, useState } from "react";
import { CloudOff, MapPinned } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import {
  EVENTO_CAMPO_MUDOU,
  campoDisponivel,
  garantirDonoCampo,
  lerMeta,
} from "@/lib/offline/campo-db";
import { PAGINA_CAMPO_OFFLINE } from "@/lib/offline/campo-rotas";
import { prepararCampo } from "@/lib/offline/preparar-campo";

const INTERVALO_PREPARO_MS = 60 * 60 * 1000;
const ESPERA_INICIAL_MS = 8000;

export function horaDoPreparo(ms: number): string {
  const d = new Date(ms);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return d.toLocaleString("pt-BR", {
    ...(mesmoDia ? {} : { day: "2-digit", month: "2-digit" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function registrarServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  // Mesmo arquivo do push: um service worker só por site.
  await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
}

/** Deixa o celular pronto para abrir as telas de campo sem internet e avisa quando está sem sinal. */
export function CampoOfflineInit({ userId }: { userId: string | null }) {
  const online = useOnline();
  const [preparadoEm, setPreparadoEm] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || !campoDisponivel()) return;
    let vivo = true;
    let pronto = false;

    const atualizarHora = () => {
      lerMeta()
        .then((meta) => {
          if (vivo) setPreparadoEm(meta?.preparado_em ?? null);
        })
        .catch(() => {});
    };

    const talvezPreparar = async () => {
      if (!pronto || !navigator.onLine || document.visibilityState !== "visible") return;
      const meta = await lerMeta().catch(() => null);
      const ultimo = meta?.preparado_em ?? 0;
      if (Date.now() - ultimo < INTERVALO_PREPARO_MS) return;
      await prepararCampo(userId);
    };

    void (async () => {
      try {
        await garantirDonoCampo(userId);
      } catch {
        return;
      }
      pronto = true;
      atualizarHora();
      registrarServiceWorker().catch(() => {});
    })();

    const primeira = setTimeout(() => void talvezPreparar(), ESPERA_INICIAL_MS);
    const aoVoltar = () => void talvezPreparar();
    const aoVoltarTela = () => {
      if (document.visibilityState === "visible") void talvezPreparar();
    };
    const intervalo = setInterval(() => void talvezPreparar(), 5 * 60 * 1000);

    window.addEventListener("online", aoVoltar);
    window.addEventListener(EVENTO_CAMPO_MUDOU, atualizarHora);
    document.addEventListener("visibilitychange", aoVoltarTela);
    return () => {
      vivo = false;
      clearTimeout(primeira);
      clearInterval(intervalo);
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener(EVENTO_CAMPO_MUDOU, atualizarHora);
      document.removeEventListener("visibilitychange", aoVoltarTela);
    };
  }, [userId]);

  if (online) return null;

  return (
    <div className="border-b border-at bg-at-card-soft px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-[13px] leading-snug text-at-muted sm:text-[14px]">
          <CloudOff className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="min-w-0">
            <span className="text-at-primary">Sem internet</span>
            <span className="text-at-soft">
              {" · "}
              {preparadoEm
                ? `usando dados salvos às ${horaDoPreparo(preparadoEm)}`
                : "este aparelho ainda não baixou a rota"}
            </span>
          </span>
        </p>
        {/* <a> e não <Link>: sem internet a navegação precisa ser uma página inteira. */}
        <a
          href={PAGINA_CAMPO_OFFLINE}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-at bg-at-card px-3 py-1.5 text-[12px] font-medium text-at-link transition hover:bg-at-card-soft sm:text-[13px]"
        >
          <MapPinned className="h-3.5 w-3.5" />
          Modo campo
        </a>
      </div>
    </div>
  );
}
