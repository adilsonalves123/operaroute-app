"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, ChevronDown, ChevronUp, Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

import type { PeriodoAnaliseRange } from "@/lib/analise/periodo-analise";

type Mensagem = { role: "user" | "assistant"; content: string };

export function InteligenciaIAPainel({
  className,
  semCabecalho = false,
  periodoLabel,
  periodoPreset,
  periodoDe,
  periodoAte,
}: {
  className?: string;
  semCabecalho?: boolean;
  periodoLabel?: string;
  periodoPreset?: PeriodoAnaliseRange["preset"];
  periodoDe?: string;
  periodoAte?: string;
}) {
  const searchParams = useSearchParams();
  const deUrl = searchParams.get("de") ?? undefined;
  const ateUrl = searchParams.get("ate") ?? undefined;
  const de = periodoDe ?? deUrl;
  const ate = periodoAte ?? ateUrl;

  const [minimizado, setMinimizado] = useState(false);
  const [openaiAtivo, setOpenaiAtivo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [fonte, setFonte] = useState<"openai" | "local" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [modelo, setModelo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analise/ia-personalizada", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOpenaiAtivo(Boolean(d.openai)))
      .catch(() => setOpenaiAtivo(false));
  }, []);

  const executar = useCallback(
    async (texto: string | undefined, historicoBase: Mensagem[]) => {
      const q = (texto ?? "").trim();
      const isBriefing = !q && historicoBase.length === 0;
      if (!q && !isBriefing) return;

      setMinimizado(false);
      setLoading(true);
      setAviso(null);

      const historico = historicoBase.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (q) {
        setMensagens((prev) => [...prev, { role: "user", content: q }]);
        setPergunta("");
      }

      try {
        const res = await fetch("/api/analise/ia-personalizada", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            pergunta: q || undefined,
            historico,
            periodo: periodoPreset,
            de,
            ate,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMensagens((prev) => [
            ...prev,
            { role: "assistant", content: data.error ?? "Erro ao gerar análise." },
          ]);
          return;
        }
        setFonte(data.fonte ?? "local");
        setModelo(data.modelo ?? null);
        setAviso(data.aviso ?? null);
        setMensagens((prev) => [
          ...prev,
          { role: "assistant", content: data.texto ?? "Sem resposta." },
        ]);
      } catch {
        setMensagens((prev) => [
          ...prev,
          { role: "assistant", content: "Erro de conexão. Tente novamente." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [periodoPreset, de, ate]
  );

  const consultar = useCallback(
    (texto?: string) => {
      void executar(texto ?? pergunta, mensagens);
    },
    [executar, pergunta, mensagens]
  );

  const novoBriefing = useCallback(() => {
    setMensagens([]);
    setFonte(null);
    setAviso(null);
    void executar("", []);
  }, [executar]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.06] via-transparent to-transparent",
        semCabecalho ? "p-6" : minimizado ? "p-4" : "p-6",
        className
      )}
    >
      {!semCabecalho && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setMinimizado((v) => !v)}
            className="flex min-w-0 flex-1 gap-3 text-left rounded-lg -m-1 p-1 hover:bg-at-card-soft transition"
            aria-expanded={!minimizado}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20">
              <Sparkles className="h-5 w-5 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Inteligência personalizada (IA)</h2>
                {minimizado ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-at-muted" />
                ) : (
                  <ChevronUp className="h-4 w-4 shrink-0 text-at-muted" />
                )}
              </div>
              <p className="mt-0.5 text-sm text-at-muted">
                {minimizado && mensagens.length > 0
                  ? `${mensagens.length} mensagem(ns)${loading ? " · pensando..." : ""}`
                  : "Análise operacional em todos os nichos — com base nos seus dados reais"}
              </p>
              {!minimizado && openaiAtivo != null && (
                <p className="mt-1 text-xs text-at-soft">
                  {openaiAtivo
                    ? "Motor: OpenAI · análise contextual"
                    : "Motor: análise local · configure OPENAI_API_KEY para IA completa"}
                </p>
              )}
            </div>
          </button>

          {!minimizado && (
            <button
              type="button"
              onClick={novoBriefing}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-at-muted hover:border-purple-500/30 hover:text-purple-300 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Novo briefing
            </button>
          )}
        </div>
      )}

      {semCabecalho && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {openaiAtivo != null && (
            <p className="text-xs text-at-soft">
              {openaiAtivo
                ? "Motor: OpenAI · análise contextual"
                : "Motor: análise local · configure OPENAI_API_KEY para IA completa"}
            </p>
          )}
          <button
            type="button"
            onClick={novoBriefing}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-at-muted hover:border-purple-500/30 hover:text-purple-300 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Novo briefing
          </button>
        </div>
      )}

      {(semCabecalho || !minimizado) && (
        <>
          {mensagens.length === 0 && (
            <CampoPergunta
              className={semCabecalho ? undefined : "mt-5"}
              pergunta={pergunta}
              onChange={setPergunta}
              onEnviar={() => consultar()}
              loading={loading}
              multiline
            />
          )}

          {mensagens.length === 0 ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => novoBriefing()}
                disabled={loading}
                className="w-full rounded-xl border border-purple-500/30 bg-purple-500/10 py-3 text-sm font-medium text-purple-200 hover:bg-purple-500/15 disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando operação...
                  </span>
                ) : (
                  `Gerar análise${periodoLabel ? ` · ${periodoLabel.toLowerCase()}` : ""}`
                )}
              </button>
            </div>
          ) : (
            <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {mensagens.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "ml-8 border border-slate-700/50 bg-slate-800/40 text-at-primary/90"
                      : "mr-4 border border-purple-500/15 bg-purple-500/[0.04] text-at-primary/90"
                  )}
                >
                  {m.role === "assistant" && (
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-purple-400/80">
                      <Bot className="h-3 w-3" />
                      {fonte === "openai" ? `IA${modelo ? ` · ${modelo}` : ""}` : "Análise local"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}

              {loading && (
                <div className="mr-4 flex items-center gap-2 rounded-xl border border-purple-500/15 bg-purple-500/[0.04] px-4 py-3 text-sm text-at-muted">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-purple-400" />
                  <span className="animate-pulse">Pensando na resposta...</span>
                </div>
              )}

              {aviso && !loading && (
                <p className="text-center text-xs text-amber-400/90">{aviso}</p>
              )}
            </div>
          )}

          {mensagens.length > 0 && (
            <CampoPergunta
              className="mt-4"
              pergunta={pergunta}
              onChange={setPergunta}
              onEnviar={() => consultar()}
              loading={loading}
            />
          )}
        </>
      )}
    </div>
  );
}

function CampoPergunta({
  pergunta,
  onChange,
  onEnviar,
  loading,
  className,
  multiline = false,
}: {
  pergunta: string;
  onChange: (v: string) => void;
  onEnviar: () => void;
  loading: boolean;
  className?: string;
  multiline?: boolean;
}) {
  const sharedClass =
    "w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-white placeholder:text-at-soft disabled:opacity-60 resize-y";

  return (
    <div className={cn("flex gap-2 items-end", className)}>
      {multiline ? (
        <textarea
          value={pergunta}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!loading && pergunta.trim()) onEnviar();
            }
          }}
          placeholder="Pergunte sobre cassino, urso, fura-fura, pontos, rotas ou estoque..."
          disabled={loading}
          rows={4}
          className={cn(sharedClass, "flex-1 min-h-[112px] max-h-48")}
        />
      ) : (
        <input
          value={pergunta}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onEnviar()}
          placeholder="Pergunte sobre máquinas, pontos ou operação..."
          disabled={loading}
          className={cn(sharedClass, "flex-1 py-2")}
        />
      )}
      <button
        type="button"
        onClick={onEnviar}
        disabled={loading || !pergunta.trim()}
        className="shrink-0 rounded-lg bg-purple-500 px-4 py-3 text-white hover:bg-purple-400 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
