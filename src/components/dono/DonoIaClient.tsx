"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { cn } from "@/lib/utils";

const MODOS = [
  {
    id: "briefing",
    label: "Briefing",
    desc: "Visão executiva + 5 ações da semana",
  },
  {
    id: "conversoes",
    label: "Conversões",
    desc: "Gargalos do funil e experimentos",
  },
  {
    id: "aceitacoes",
    label: "Aceitações",
    desc: "Trials, upgrade e reengajamento",
  },
  {
    id: "suporte",
    label: "Suporte",
    desc: "Priorizar fila e reduzir escalonamento",
  },
  { id: "livre", label: "Perguntar", desc: "Pergunta livre sobre o SaaS" },
];

export function DonoIaClient({ email }: { email: string }) {
  const [modo, setModo] = useState("briefing");
  const [pergunta, setPergunta] = useState("");
  const [texto, setTexto] = useState("");
  const [modelo, setModelo] = useState("");
  const [loading, setLoading] = useState(false);
  const [iaOk, setIaOk] = useState(false);
  const [erro, setErro] = useState("");
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    void (async () => {
      const [ia, cmd] = await Promise.all([
        fetch("/api/dono/ia").then((r) => r.json()),
        fetch("/api/dono/command").then((r) => r.json()),
      ]);
      setIaOk(Boolean(ia.ia_disponivel));
      if (cmd.suporte?.humano_aberto) setBadge(cmd.suporte.humano_aberto);
    })();
  }, []);

  async function gerar() {
    if (modo === "livre" && !pergunta.trim()) {
      setErro("Escreva sua pergunta no campo de mensagem.");
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/dono/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo, pergunta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha na IA.");
        return;
      }
      setTexto(data.texto ?? "");
      setModelo(data.modelo ?? "");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DonoShell
      email={email}
      badgeSuporte={badge}
      title="IA Copiloto"
      subtitle="Advisor de growth e CS com os dados reais do seu painel — conversões, aceitações e suporte."
    >
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1.5">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModo(m.id)}
              className={cn(
                "w-full rounded-sm border px-3 py-2.5 text-left transition",
                modo === m.id
                  ? "border-[#c4a574]/40 bg-[#c4a574]/12"
                  : "border-white/[0.07] hover:bg-white/[0.02]"
              )}
            >
              <p className="text-[13px] text-[#f4efe6]">{m.label}</p>
              <p className="text-[11px] text-slate-500">{m.desc}</p>
            </button>
          ))}
          {!iaOk && (
            <p className="mt-3 text-[11px] leading-relaxed text-amber-200/80">
              Sem OPENAI_API_KEY o copiloto usa heurísticas locais com os mesmos
              números do painel.
            </p>
          )}
        </div>

        <div className="flex min-h-[420px] flex-col">
          <div className="min-h-0 flex-1">
            {erro && (
              <p className="mb-4 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
                {erro}
              </p>
            )}

            {texto ? (
              <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] px-5 py-5">
                {modelo && (
                  <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                    Modelo · {modelo}
                  </p>
                )}
                <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-slate-200">
                  {texto}
                </div>
              </div>
            ) : (
              !loading && (
                <p className="max-w-md text-[13px] text-slate-500">
                  Escolha um modo, escreva um contexto se quiser e envie. A IA lê
                  MRR, funil, trials em risco e fila de suporte antes de responder.
                </p>
              )
            )}

            {loading && (
              <p className="flex items-center gap-2 text-[13px] text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando o painel…
              </p>
            )}
          </div>

          <div className="mt-6 rounded-sm border border-white/[0.1] bg-white/[0.03] p-3">
            <label className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-500">
              Mensagem
            </label>
            <textarea
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              rows={3}
              placeholder={
                modo === "livre"
                  ? "Ex.: Quais clientes eu deveria ligar esta semana para converter trial?"
                  : "Opcional — acrescente contexto ou uma pergunta específica…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void gerar();
                }
              }}
              className="w-full resize-y rounded-sm border border-transparent bg-transparent px-1 py-1 text-[13px] text-[#f4efe6] outline-none placeholder:text-slate-600"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-600">
                Ctrl+Enter para enviar
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => void gerar()}
                className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-4 py-2 text-[13px] text-[#e8d5b0] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : modo === "livre" ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "Analisando…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DonoShell>
  );
}
