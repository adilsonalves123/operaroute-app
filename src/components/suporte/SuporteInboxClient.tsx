"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Instrument_Serif, Outfit } from "next/font/google";
import { ArrowLeft, Loader2, Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SuporteConversa, SuporteMensagem } from "@/lib/suporte/types";
import { SuporteAnexoBloco } from "@/components/suporte/SuporteAnexoBloco";
import { validarArquivoSuporte } from "@/lib/suporte/anexos";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-inbox-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-inbox-sans",
});

export function SuporteInboxClient() {
  const [conversas, setConversas] = useState<SuporteConversa[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<SuporteMensagem[]>([]);
  const [conversa, setConversa] = useState<SuporteConversa | null>(null);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);
  const [erro, setErro] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const listar = useCallback(async () => {
    const res = await fetch("/api/suporte/inbox?modo=humano");
    const data = await res.json();
    if (!res.ok) {
      setErro(data.error ?? "Sem acesso à inbox.");
      setBoot(false);
      return;
    }
    setConversas(data.conversas ?? []);
    setErro("");
    setBoot(false);
  }, []);

  const abrir = useCallback(async (id: string) => {
    setSelecionada(id);
    const res = await fetch(`/api/suporte/inbox/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setErro(data.error ?? "Falha ao abrir.");
      return;
    }
    setConversa(data.conversa);
    setMensagens(data.mensagens ?? []);
  }, []);

  useEffect(() => {
    void listar();
    const id = window.setInterval(() => void listar(), 12000);
    return () => window.clearInterval(id);
  }, [listar]);

  useEffect(() => {
    if (!selecionada) return;
    const id = window.setInterval(() => void abrir(selecionada), 8000);
    return () => window.clearInterval(id);
  }, [selecionada, abrir]);

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
        res = await fetch(`/api/suporte/inbox/${selecionada}`, {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch(`/api/suporte/inbox/${selecionada}`, {
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
      const res = await fetch(`/api/suporte/inbox/${selecionada}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "resolver" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não encerrou.");
        return;
      }
      setSelecionada(null);
      setConversa(null);
      setMensagens([]);
      void listar();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(display.variable, sans.variable)}
      style={{ fontFamily: "var(--font-inbox-sans), system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <Link
          href="/suporte"
          className="inline-flex items-center gap-1.5 text-[12px] text-at-muted transition hover:text-at-link"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao suporte
        </Link>

        <h1
          className="mt-4 text-[clamp(1.8rem,4vw,2.6rem)] tracking-tight text-at-primary"
          style={{ fontFamily: "var(--font-inbox-display), Georgia, serif" }}
        >
          Inbox suporte
        </h1>
        <p className="mt-2 text-[13px] text-at-muted">
          Conversas escaladas da IA — responda aqui.
        </p>

        {erro && (
          <p className="mt-4 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {erro}
          </p>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-sm border border-at bg-white/[0.02]">
            <p className="border-b border-at px-3 py-2.5 text-[10px] uppercase tracking-[0.16em] text-at-muted">
              Aguardando · {conversas.length}
            </p>
            {boot ? (
              <p className="p-4 text-[13px] text-at-muted">Carregando…</p>
            ) : conversas.length === 0 ? (
              <p className="p-4 text-[13px] text-at-muted">Nenhuma fila humana no momento.</p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-[var(--at-border-soft)] overflow-y-auto">
                {conversas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void abrir(c.id)}
                      className={cn(
                        "w-full px-3 py-3 text-left transition hover:bg-at-card-soft",
                        selecionada === c.id && "bg-[#c4a574]/10"
                      )}
                    >
                      <p className="truncate text-[13px] text-at-primary">
                        {c.empresa_nome ?? "Empresa"}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-at-muted">
                        {c.user_nome ?? c.user_email ?? "Cliente"} · {c.assunto ?? "—"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="flex min-h-[55vh] flex-col rounded-sm border border-at bg-white/[0.02]">
            {!selecionada ? (
              <p className="m-auto text-[13px] text-at-muted">Selecione uma conversa.</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-at px-4 py-3">
                  <div>
                    <p className="text-[14px] text-at-primary">{conversa?.empresa_nome}</p>
                    <p className="text-[12px] text-at-muted">
                      {conversa?.user_nome} · {conversa?.user_email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void resolver()}
                    disabled={loading}
                    className="rounded-sm border border-at-soft px-3 py-1.5 text-[12px] text-at-muted hover:text-at-primary disabled:opacity-50"
                  >
                    Encerrar
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {mensagens.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[90%] rounded-sm px-3 py-2 text-[13px]",
                        m.autor === "cliente" && "ml-auto bg-[#c4a574]/15 text-at-primary",
                        m.autor === "staff" && "border border-[#c4a574]/25 bg-at-card-soft text-at-primary",
                        m.autor === "ia" && "bg-at-card-soft text-at-primary/85",
                        m.autor === "sistema" && "mx-auto max-w-full bg-transparent text-center text-[11px] text-at-muted"
                      )}
                    >
                      {m.autor !== "sistema" && (
                        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-at-muted">
                          {m.autor === "cliente"
                            ? "Cliente"
                            : m.autor === "ia"
                              ? "IA"
                              : m.autor_nome ?? "Você"}
                        </p>
                      )}
                      {m.corpo && <p className="whitespace-pre-wrap">{m.corpo}</p>}
                      {m.anexo_url && (
                        <SuporteAnexoBloco
                          url={m.anexo_url}
                          nome={m.anexo_nome}
                          mime={m.anexo_mime}
                          tamanho={m.anexo_tamanho}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-at p-3">
                  {arquivo && (
                    <div className="mb-2 flex items-center gap-2 rounded-sm border border-at-soft px-2.5 py-1.5 text-[12px] text-at-primary/85">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
                      <button
                        type="button"
                        onClick={() => setArquivo(null)}
                        className="p-1 text-at-muted hover:text-at-primary"
                        aria-label="Remover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        if (!f) return;
                        const err = validarArquivoSuporte(f);
                        if (err) {
                          setErro(err);
                          return;
                        }
                        setErro("");
                        setArquivo(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={loading}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-at-soft text-at-muted hover:text-at-link disabled:opacity-40"
                      aria-label="Anexar"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void responder();
                        }
                      }}
                      placeholder="Responder ao cliente…"
                      className="flex-1 rounded-sm border border-at-soft bg-transparent px-3 py-2.5 text-[13px] text-at-primary outline-none focus:border-[#c4a574]/35"
                    />
                    <button
                      type="button"
                      onClick={() => void responder()}
                      disabled={loading || (!texto.trim() && !arquivo)}
                      className="inline-flex h-11 items-center gap-2 rounded-sm bg-[#c4a574] px-4 text-[13px] font-medium text-[#1a140c] disabled:opacity-40"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Enviar
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
