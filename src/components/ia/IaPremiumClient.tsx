"use client";

import { useEffect, useRef, useState } from "react";
import { Instrument_Serif, Outfit } from "next/font/google";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ia-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-ia-sans",
});

const PROMPTS = [
  { id: "01", label: "Prioridade de kits", q: "Qual kit devo priorizar nos próximos pontos?" },
  { id: "02", label: "Furador suspeito", q: "Algum ponto pode ter furador mal montado?" },
  { id: "03", label: "Ponto do mês", q: "Qual ponto mais faturou este mês?" },
  { id: "04", label: "Onde perco dinheiro", q: "Onde estou perdendo dinheiro?" },
  { id: "05", label: "Rota de hoje", q: "Quais pontos preciso visitar hoje?" },
  { id: "06", label: "Saúde do estoque", q: "Meu estoque está bom?" },
  { id: "07", label: "Briefing do mês", q: "Me faça um resumo do mês" },
  { id: "08", label: "O que melhorar", q: "O que eu preciso melhorar na operação?" },
] as const;

type Turno = {
  id: string;
  pergunta: string;
  resposta: string;
  fonte?: string;
};

export function IaPremiumClient() {
  const [pergunta, setPergunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [erro, setErro] = useState("");
  const [ativo, setAtivo] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAtivo(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (turnos.length || loading) {
      fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [turnos, loading]);

  async function perguntar(texto?: string) {
    const q = (texto ?? pergunta).trim();
    if (!q || loading) return;

    setLoading(true);
    setPergunta("");
    setErro("");
    const id = crypto.randomUUID();
    setTurnos((prev) => [...prev, { id, pergunta: q, resposta: "" }]);

    try {
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q }),
      });
      const data = await res.json();
      const resposta = data.resposta ?? "Não foi possível gerar resposta.";
      setTurnos((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, resposta, fonte: data.fonte } : t
        )
      );
    } catch {
      setTurnos((prev) => prev.filter((t) => t.id !== id));
      setErro("Falha ao consultar a inteligência. Tente de novo.");
      setPergunta(q);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void perguntar();
    }
  }

  const temConversa = turnos.length > 0 || loading;

  return (
    <div
      className={cn(display.variable, sans.variable)}
      style={{ fontFamily: "var(--font-ia-sans), system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes iaRise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes iaLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>

      <div className="mx-auto flex max-w-3xl flex-col gap-10 pt-6 sm:pt-10 lg:pt-14">
        {/* Hero — one composition */}
        <header
          className={cn(
            "text-center transition-opacity duration-700",
            ativo ? "opacity-100" : "opacity-0"
          )}
          style={{ animation: ativo ? "iaRise 0.9s ease-out both" : undefined }}
        >
          <p
            className="text-[11px] font-medium uppercase tracking-[0.42em] text-at-link/90"
            style={{ letterSpacing: "0.42em" }}
          >
            OperaRoute
          </p>
          <h1
            className="mt-4 text-[clamp(2.75rem,8vw,4.75rem)] leading-[0.95] tracking-tight text-at-primary"
            style={{ fontFamily: "var(--font-ia-display), Georgia, serif" }}
          >
            Inteligência
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-at-muted">
            Pergunte sobre a operação. A resposta nasce dos seus pontos, coletas e
            estoque — não de um modelo genérico.
          </p>
          <div
            className="mx-auto mt-8 h-px w-24 origin-center bg-gradient-to-r from-transparent via-[#c4a574]/70 to-transparent"
            style={{ animation: ativo ? "iaLine 1.1s 0.35s ease-out both" : undefined }}
          />
        </header>

        {/* Composer */}
        <div
          className="relative"
          style={{ animation: ativo ? "iaRise 0.85s 0.15s ease-out both" : undefined }}
        >
          <div
            className="rounded-2xl border border-at-soft bg-[#0c1018]/92 p-2 sm:p-2.5"
            style={{
              boxShadow:
                "0 0 0 1px rgba(196,165,116,0.06), 0 24px 80px -32px rgba(0,0,0,0.85)",
            }}
          >
            <label className="sr-only" htmlFor="ia-pergunta">
              Pergunta para a inteligência
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="ia-pergunta"
                ref={inputRef}
                rows={2}
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="O que a operação precisa saber agora?"
                disabled={loading}
                className="min-h-[3.25rem] max-h-40 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-[15px] text-at-primary placeholder:text-at-muted focus:outline-none focus:ring-0 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void perguntar()}
                disabled={loading || !pergunta.trim()}
                aria-label="Enviar pergunta"
                className="mb-1.5 mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c4a574] text-[#0a0c10] transition hover:bg-[#d4b888] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>

          {erro && (
            <p className="mt-3 text-center text-sm text-red-400/90">{erro}</p>
          )}
        </div>

        {/* Prompts — editorial, not pills */}
        {!temConversa && (
          <nav
            aria-label="Sugestões"
            className="space-y-1"
            style={{ animation: ativo ? "iaRise 0.9s 0.28s ease-out both" : undefined }}
          >
            <p className="mb-4 text-center text-[11px] uppercase tracking-[0.28em] text-at-muted">
              Comece por aqui
            </p>
            <ul className="divide-y divide-white/[0.05] border-y border-white/[0.05]">
              {PROMPTS.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void perguntar(p.q)}
                    className="group flex w-full items-baseline gap-4 py-3.5 text-left transition hover:bg-white/[0.02] disabled:opacity-50 sm:gap-6"
                    style={{
                      animation: ativo
                        ? `iaRise 0.6s ${0.32 + i * 0.04}s ease-out both`
                        : undefined,
                    }}
                  >
                    <span className="w-7 shrink-0 font-mono text-[11px] text-at-link/70">
                      {p.id}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-at-muted group-hover:text-at-muted">
                        {p.label}
                      </span>
                      <span className="mt-0.5 block text-[15px] text-at-primary/90 group-hover:text-at-primary">
                        {p.q}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-[11px] uppercase tracking-wider text-at-link/0 transition group-hover:text-at-link/80 sm:inline">
                      Perguntar
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Conversation */}
        {temConversa && (
          <section className="space-y-8 pb-4" aria-live="polite">
            {turnos.map((t) => (
              <article
                key={t.id}
                className="space-y-4"
                style={{ animation: "iaRise 0.55s ease-out both" }}
              >
                <div className="flex justify-end">
                  <p
                    className="max-w-[92%] rounded-2xl rounded-br-md border border-[#c4a574]/20 bg-[#c4a574]/10 px-4 py-3 text-[15px] leading-relaxed text-at-primary sm:max-w-[85%]"
                    style={{ fontFamily: "var(--font-ia-display), Georgia, serif" }}
                  >
                    {t.pergunta}
                  </p>
                </div>

                <div className="relative pl-4 sm:pl-6">
                  <div className="absolute bottom-2 left-0 top-2 w-px bg-gradient-to-b from-[#c4a574]/50 to-transparent" />
                  {!t.resposta ? (
                    <div className="flex items-center gap-3 py-2 text-sm text-at-muted">
                      <Sparkles className="h-4 w-4 animate-pulse text-at-link" />
                      <span className="tracking-wide">Lendo a operação…</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-at-link/80">
                        Resposta
                        {t.fonte ? (
                          <span className="ml-2 tracking-normal text-at-muted normal-case">
                            · {t.fonte === "openai" ? "modelo vivo" : "análise local"}
                          </span>
                        ) : null}
                      </p>
                      <div
                        className="whitespace-pre-wrap text-[15.5px] leading-[1.7] text-at-primary/90/95"
                      >
                        {t.resposta}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}

            {loading && turnos.every((t) => t.resposta) && (
              <div className="flex items-center gap-3 pl-4 text-sm text-at-muted sm:pl-6">
                <Loader2 className="h-4 w-4 animate-spin text-at-link" />
                Analisando…
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setTurnos([]);
                  setErro("");
                  inputRef.current?.focus();
                }}
                className="text-[11px] uppercase tracking-[0.2em] text-at-muted transition hover:text-at-link"
              >
                Nova conversa
              </button>
            </div>
            <div ref={fimRef} />
          </section>
        )}
      </div>
    </div>
  );
}
