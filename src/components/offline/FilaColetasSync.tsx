"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";
import { EVENTO_FILA_MUDOU, filaDisponivel, listarFila, type EnvioFila } from "@/lib/offline/fila-db";
import {
  descartarEnvio,
  sincronizarFila,
  tentarEnvioDeNovo,
  type ResumoSincronizacao,
} from "@/lib/offline/envio-coleta";

const INTERVALO_MS = 30_000;

function horaCurta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Aviso de coletas guardadas no celular + envio automático quando o sinal volta. */
export function FilaColetasSync() {
  const [itens, setItens] = useState<EnvioFila[]>([]);
  const online = useOnline();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<ResumoSincronizacao | null>(null);

  const recarregar = useCallback(async () => {
    try {
      setItens(await listarFila());
    } catch {
      setItens([]);
    }
  }, []);

  const sincronizar = useCallback(async (incluirErros = false) => {
    setEnviando(true);
    try {
      const r = await sincronizarFila({ incluirErros });
      if (r.enviados > 0 || r.revisar.length > 0 || r.precisaLogin) setAviso(r);
    } finally {
      setEnviando(false);
      void recarregar();
    }
  }, [recarregar]);

  useEffect(() => {
    if (!filaDisponivel()) return;
    let vivo = true;
    listarFila()
      .then((lista) => {
        if (vivo) setItens(lista);
      })
      .catch(() => {});
    const primeira = setTimeout(() => void sincronizar(), 1500);

    const aoMudar = () => void recarregar();
    const aoVoltarSinal = () => void sincronizar();
    const aoVoltarTela = () => {
      if (document.visibilityState === "visible") void sincronizar();
    };

    window.addEventListener(EVENTO_FILA_MUDOU, aoMudar);
    window.addEventListener("online", aoVoltarSinal);
    document.addEventListener("visibilitychange", aoVoltarTela);
    const t = setInterval(() => {
      if (navigator.onLine) void sincronizar();
    }, INTERVALO_MS);

    return () => {
      window.removeEventListener(EVENTO_FILA_MUDOU, aoMudar);
      window.removeEventListener("online", aoVoltarSinal);
      document.removeEventListener("visibilitychange", aoVoltarTela);
      vivo = false;
      clearTimeout(primeira);
      clearInterval(t);
    };
  }, [recarregar, sincronizar]);

  const aguardando = itens.filter((i) => i.status !== "erro");
  const comErro = itens.filter((i) => i.status === "erro");
  const precisaLogin = itens.some((i) => i.status === "login");

  if (itens.length === 0 && !aviso) return null;

  return (
    <div className="border-b border-at bg-at-card-soft px-4 py-2.5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {itens.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="flex min-w-0 items-center gap-2 text-left text-[13px] leading-snug text-at-muted sm:text-[14px]"
            >
              {comErro.length > 0 ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              ) : online ? (
                <UploadCloud className="h-4 w-4 shrink-0 text-at-link" />
              ) : (
                <CloudOff className="h-4 w-4 shrink-0 text-amber-400" />
              )}
              <span className="min-w-0">
                {aguardando.length > 0 ? (
                  <span className="text-at-primary">
                    {aguardando.length === 1
                      ? "1 envio guardado no celular"
                      : `${aguardando.length} envios guardados no celular`}
                  </span>
                ) : null}
                {aguardando.length > 0 && comErro.length > 0 ? (
                  <span className="text-at-soft"> · </span>
                ) : null}
                {comErro.length > 0 ? (
                  <span className="text-amber-200">
                    {comErro.length === 1 ? "1 não foi aceito" : `${comErro.length} não foram aceitos`}
                  </span>
                ) : null}
                <span className="text-at-soft">
                  {" · "}
                  {precisaLogin
                    ? "entre de novo no app para enviar"
                    : online
                      ? "enviando sozinho"
                      : "sem sinal — envia quando voltar"}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => void sincronizar(true)}
              disabled={enviando || !online}
              className="flex shrink-0 items-center gap-1.5 rounded-sm border border-at bg-at-card px-3 py-1.5 text-[12px] font-medium text-at-link transition hover:bg-at-card-soft disabled:opacity-50 sm:text-[13px]"
            >
              {enviando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Enviar agora
            </button>
          </div>
        ) : null}

        {aberto && itens.length > 0 ? (
          <ul className="mt-2.5 space-y-2">
            {itens.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-sm border px-3 py-2 text-[13px]",
                  item.status === "erro"
                    ? "border-amber-500/30 bg-amber-500/[0.06]"
                    : "border-at bg-at-card"
                )}
              >
                <div className="min-w-0">
                  <p className="text-at-primary">
                    {item.titulo}
                    {item.ponto_nome ? <span className="text-at-muted"> · {item.ponto_nome}</span> : null}
                  </p>
                  <p className="text-[12px] text-at-soft">
                    Feita em {horaCurta(item.criado_em)}
                    {item.fotos.length > 0
                      ? ` · ${item.fotos.length} foto${item.fotos.length > 1 ? "s" : ""} para subir`
                      : ""}
                  </p>
                  {item.erro ? <p className="mt-0.5 text-[12px] text-amber-200">{item.erro}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status === "erro" ? (
                    <button
                      type="button"
                      onClick={() => void tentarEnvioDeNovo(item.id)}
                      className="rounded-sm p-1.5 text-at-link transition hover:bg-at-card-soft"
                      aria-label="Tentar de novo"
                      title="Tentar de novo"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Descartar este envio? A coleta guardada no celular será apagada e não vai para o sistema."
                        )
                      ) {
                        void descartarEnvio(item.id);
                      }
                    }}
                    className="rounded-sm p-1.5 text-at-soft transition hover:bg-at-card-soft hover:text-red-300"
                    aria-label="Descartar"
                    title="Descartar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {aviso ? (
          <div
            className={cn(
              "flex items-start justify-between gap-3 text-[13px]",
              itens.length > 0 && "mt-2.5"
            )}
          >
            <div className="min-w-0 text-at-muted">
              {aviso.enviados > 0 ? (
                <p className="text-at-primary">
                  {aviso.enviados === 1
                    ? "1 envio guardado chegou ao sistema."
                    : `${aviso.enviados} envios guardados chegaram ao sistema.`}
                </p>
              ) : null}
              {aviso.revisar.length > 0 ? (
                <div className="mt-1 text-amber-200">
                  <p>Mudou algo no ponto enquanto você estava sem sinal. Gravado com o valor atual e marcado para conferir:</p>
                  <ul className="mt-0.5 list-disc pl-5">
                    {aviso.revisar.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aviso.precisaLogin ? (
                <p className="text-amber-200">Sua sessão expirou. Entre de novo para enviar o que está guardado.</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="rounded-sm p-1.5 text-at-soft transition hover:bg-at-card hover:text-at-primary"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
