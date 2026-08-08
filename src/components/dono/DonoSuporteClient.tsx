"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LifeBuoy, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import { SuporteAnexoBloco } from "@/components/suporte/SuporteAnexoBloco";
import { validarArquivoSuporte } from "@/lib/suporte/anexos";
import type { SuporteConversa, SuporteMensagem } from "@/lib/suporte/types";
import { cn } from "@/lib/utils";

type ConversaRow = SuporteConversa & { empresa_nome?: string | null };

const FILTROS = [
  { id: "humano", label: "Aguardando você" },
  { id: "abertos", label: "Abertos" },
  { id: "resolvido", label: "Resolvidos" },
  { id: "todos", label: "Todos" },
];

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DonoSuporteClient({ email }: { email: string }) {
  const [modo, setModo] = useState("humano");
  const [conversas, setConversas] = useState<ConversaRow[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [conversa, setConversa] = useState<ConversaRow | null>(null);
  const [mensagens, setMensagens] = useState<SuporteMensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);
  const [erro, setErro] = useState("");
  const [iaOk, setIaOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const listar = useCallback(async () => {
    const res = await fetch(`/api/dono/suporte?modo=${modo}`);
    const data = await res.json();
    if (!res.ok) {
      setErro(data.error ?? "Falha na inbox.");
      setBoot(false);
      return;
    }
    setConversas(data.conversas ?? []);
    setErro("");
    setBoot(false);
  }, [modo]);

  const abrir = useCallback(async (id: string) => {
    setSelecionada(id);
    const res = await fetch(`/api/dono/suporte/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setErro(data.error ?? "Falha ao abrir.");
      return;
    }
    setConversa(data.conversa);
    setMensagens(data.mensagens ?? []);
    setIaOk(Boolean(data.ia_disponivel));
  }, []);

  useEffect(() => {
    void listar();
    const id = window.setInterval(() => void listar(), 10000);
    return () => window.clearInterval(id);
  }, [listar]);

  useEffect(() => {
    if (!selecionada) return;
    const id = window.setInterval(() => void abrir(selecionada), 8000);
    return () => window.clearInterval(id);
  }, [selecionada, abrir]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.length]);

  async function sugerirIa() {
    if (!selecionada || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dono/suporte/${selecionada}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "sugerir_ia" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "IA indisponível.");
        return;
      }
      setTexto(data.sugestao ?? "");
    } finally {
      setLoading(false);
    }
  }

  async function responder() {
    if (!selecionada || loading) return;
    if (!texto.trim() && !arquivo) return;
    setLoading(true);
    try {
      let res: Response;
      if (arquivo) {
        const form = new FormData();
        form.set("texto", texto.trim());
        form.set("arquivo", arquivo);
        res = await fetch(`/api/dono/suporte/${selecionada}`, {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch(`/api/dono/suporte/${selecionada}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: texto.trim() }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não enviou.");
        return;
      }
      setTexto("");
      setArquivo(null);
      setConversa(data.conversa);
      setMensagens(data.mensagens ?? []);
      void listar();
    } finally {
      setLoading(false);
    }
  }

  async function resolver() {
    if (!selecionada || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dono/suporte/${selecionada}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "resolver" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não encerrou.");
        return;
      }
      setConversa(data.conversa);
      setMensagens(data.mensagens ?? []);
      void listar();
    } finally {
      setLoading(false);
    }
  }

  const humanos = conversas.filter((c) => c.modo === "humano").length;

  return (
    <DonoShell
      email={email}
      badgeSuporte={humanos}
      title="Suporte"
      subtitle="Quando o cliente pede humano no app, a conversa chega aqui — responda como dono."
      wide
    >
      {erro && (
        <p className="mb-4 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setModo(f.id)}
            className={cn(
              "rounded-sm border px-2.5 py-1.5 text-[11px] uppercase tracking-wider transition",
              modo === f.id
                ? "border-[#c4a574]/40 bg-[#c4a574]/12 text-[#e8d5b0]"
                : "border-white/10 text-slate-500 hover:text-slate-300"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-[62vh] overflow-hidden rounded-sm border border-white/[0.08] lg:grid-cols-[320px_1fr]">
        <div className="border-b border-white/[0.06] lg:border-b-0 lg:border-r">
          {boot && (
            <div className="flex items-center gap-2 px-4 py-8 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          )}
          <ul className="max-h-[40vh] divide-y divide-white/[0.05] overflow-y-auto lg:max-h-[70vh]">
            {!boot && conversas.length === 0 && (
              <li className="px-4 py-10 text-center text-[12px] text-slate-500">
                Nenhuma conversa neste filtro.
              </li>
            )}
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void abrir(c.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition",
                    selecionada === c.id
                      ? "bg-[#c4a574]/10"
                      : "hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] text-[#f4efe6]">
                      {c.assunto || "Sem assunto"}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-[9px] uppercase tracking-wider",
                        c.modo === "humano" && "text-rose-300",
                        c.modo === "ia" && "text-slate-400",
                        c.modo === "resolvido" && "text-emerald-400/80"
                      )}
                    >
                      {c.modo}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {c.empresa_nome ?? "Empresa"} · {c.user_nome ?? "Cliente"}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {when(c.last_message_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-[50vh] flex-col bg-black/20">
          {!selecionada && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
              <LifeBuoy className="h-8 w-8 text-slate-700" />
              <p className="text-[13px]">Selecione uma conversa à esquerda.</p>
              <p className="max-w-sm text-[12px] text-slate-600">
                O cliente fala no app em /suporte. Se pedir humano (ou a IA
                escalar), aparece aqui para você responder.
              </p>
            </div>
          )}

          {selecionada && conversa && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="text-[14px] text-[#f4efe6]">
                    {conversa.assunto || "Atendimento"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {conversa.empresa_nome ?? "—"} · {conversa.user_nome} ·{" "}
                    {conversa.user_email}
                  </p>
                </div>
                <div className="flex gap-2">
                  {conversa.empresa_id && (
                    <Link
                      href={`/dono/empresas/${conversa.empresa_id}`}
                      className="rounded-sm border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-[#e8d5b0]"
                    >
                      Ver cliente
                    </Link>
                  )}
                  {conversa.modo !== "resolvido" && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void resolver()}
                      className="rounded-sm border border-emerald-500/25 px-2.5 py-1.5 text-[11px] text-emerald-300/90 hover:bg-emerald-500/10"
                    >
                      Resolver
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {mensagens.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-sm border px-3 py-2 text-[13px]",
                      m.autor === "cliente" &&
                        "ml-0 border-white/10 bg-white/[0.03] text-slate-200",
                      m.autor === "staff" &&
                        "ml-auto border-[#c4a574]/25 bg-[#c4a574]/10 text-[#f4efe6]",
                      m.autor === "ia" &&
                        "border-white/10 bg-slate-900/40 text-slate-300",
                      m.autor === "sistema" &&
                        "mx-auto border-transparent bg-transparent text-center text-[11px] text-slate-500"
                    )}
                  >
                    {m.autor !== "sistema" && (
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                        {m.autor_nome || m.autor}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.corpo}</p>
                    {m.anexo_url && (
                      <div className="mt-2">
                        <SuporteAnexoBloco
                          url={m.anexo_url}
                          nome={m.anexo_nome}
                          mime={m.anexo_mime}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {conversa.modo !== "resolvido" && (
                <div className="border-t border-white/[0.06] p-3">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading || !iaOk}
                      onClick={() => void sugerirIa()}
                      className="inline-flex items-center gap-1.5 rounded-sm border border-[#c4a574]/30 px-2.5 py-1.5 text-[11px] text-[#e8d5b0] disabled:opacity-40"
                    >
                      <Sparkles className="h-3 w-3" />
                      IA sugere resposta
                    </button>
                    {!iaOk && (
                      <span className="text-[11px] text-slate-600">
                        Configure OPENAI_API_KEY para sugestões.
                      </span>
                    )}
                  </div>
                  {arquivo && (
                    <div className="mb-2 flex items-center gap-2 text-[12px] text-slate-400">
                      <Paperclip className="h-3.5 w-3.5" />
                      {arquivo.name}
                      <button type="button" onClick={() => setArquivo(null)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const v = validarArquivoSuporte(f);
                        if (v) {
                          setErro(v);
                          return;
                        }
                        setArquivo(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-sm border border-white/10 p-2.5 text-slate-400 hover:text-[#e8d5b0]"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      rows={2}
                      placeholder="Responder ao cliente…"
                      className="min-h-[44px] flex-1 resize-none rounded-sm border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-[#f4efe6] outline-none focus:border-[#c4a574]/35"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void responder();
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void responder()}
                      className="rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-3 text-[#e8d5b0] disabled:opacity-40"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DonoShell>
  );
}