"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { DataCard } from "@/components/cards/DataCard";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

const sugestoes = [
  "Qual ponto mais faturou este mês?",
  "Onde estou perdendo dinheiro?",
  "Quais pontos preciso visitar hoje?",
  "Meu estoque está bom?",
  "Qual operador está performando melhor?",
  "Me faça um resumo do mês",
  "O que eu preciso melhorar na operação?",
];

export default function IAPage() {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAsk(text?: string) {
    const q = text ?? pergunta;
    if (!q.trim()) return;
    setLoading(true);
    setPergunta(q);
    setResposta("");

    try {
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: q }),
      });
      const data = await res.json();
      setResposta(data.resposta ?? "Não foi possível gerar resposta.");
    } catch {
      setResposta("Erro ao consultar a IA. Verifique sua conexão.");
    }
    setLoading(false);
  }

  return (
    <>
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
          <Bot className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">IA do Sistema</h1>
          <p className="text-slate-400">Análises inteligentes da sua operação</p>
        </div>
      </div>

      <DataCard title="Faça uma pergunta">
        <div className="flex gap-2">
          <input
            placeholder="Pergunte sobre sua operação..."
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            className="flex-1"
          />
          <button
            onClick={() => handleAsk()}
            disabled={loading}
            className="rounded-lg bg-purple-500 px-4 py-2 text-white hover:bg-purple-400 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {sugestoes.map((s) => (
            <button
              key={s}
              onClick={() => handleAsk(s)}
              className="rounded-full border border-purple-500/30 px-3 py-1 text-xs text-purple-300 hover:bg-purple-500/10"
            >
              {s}
            </button>
          ))}
        </div>
      </DataCard>

      {(resposta || loading) && (
        <div className="glass-card p-6 border border-purple-500/20">
          <p className="text-sm text-purple-400 mb-2 font-medium">Resposta da IA</p>
          {loading ? (
            <p className="text-slate-400 animate-pulse">Analisando dados da operação...</p>
          ) : (
            <p className="text-slate-200 whitespace-pre-wrap">{resposta}</p>
          )}
        </div>
      )}
    </div>

    <LoadingOverlay
      show={loading}
      messages={[
        "Analisando dados da operação...",
        "Consultando a IA...",
        "Preparando sua resposta...",
      ]}
    />
  </>
  );
}
