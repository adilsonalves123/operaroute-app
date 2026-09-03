"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Instrument_Serif, Outfit } from "next/font/google";
import { ArrowUp, Loader2, UserRound, Bot, LifeBuoy, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SuporteConversa, SuporteMensagem } from "@/lib/suporte/types";
import { SuporteAnexoBloco } from "@/components/suporte/SuporteAnexoBloco";
import { validarArquivoSuporte } from "@/lib/suporte/anexos";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-suporte-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-suporte-sans",
});

const SUGESTOES = [
  "Como cadastrar a série do painel?",
  "Onde abro chamado de manutenção?",
  "Como montar uma rota?",
  "Falar com um atendente",
] as const;

type Props = {
  isStaff?: boolean;
};

export function SuporteClient({ isStaff = false }: Props) {
  const [conversa, setConversa] = useState<SuporteConversa | null>(null);
  const [mensagens, setMensagens] = useState<SuporteMensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);
  const [erro, setErro] = useState("");
  const [ativo, setAtivo] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/suporte/conversa");
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao carregar suporte.");
        return;
      }
      setConversa(data.conversa);
      setMensagens(data.mensagens ?? []);
      setErro("");
    } catch {
      setErro("Falha de rede ao carregar suporte.");
    } finally {
      setBoot(false);
    }
  }, []);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAtivo(true));
    void carregar();
    return () => cancelAnimationFrame(t);
  }, [carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, loading]);

  useEffect(() => {
    if (!arquivo || !arquivo.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  // Poll quando estiver com humano
  useEffect(() => {
    if (conversa?.modo !== "humano") return;
    const id = window.setInterval(() => {
      void carregar();
    }, 8000);
    return () => window.clearInterval(id);
  }, [conversa?.modo, carregar]);

  function escolherArquivo(file: File | null) {
    if (!file) {
      setArquivo(null);
      return;
    }
    const err = validarArquivoSuporte(file);
    if (err) {
      setErro(err);
      return;
    }
    setErro("");
    setArquivo(file);
  }

  async function garantirConversa() {
    if (conversa) return conversa;
    const res = await fetch("/api/suporte/conversa", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Não abriu conversa");
    setConversa(data.conversa);
    setMensagens(data.mensagens ?? []);
    return data.conversa as SuporteConversa;
  }

  async function enviar(raw?: string) {
    const msg = (raw ?? texto).trim();
    const fileToSend = raw ? null : arquivo;
    if ((!msg && !fileToSend) || loading) return;
    setLoading(true);
    setTexto("");
    setArquivo(null);
    setErro("");
    try {
      await garantirConversa();
      let res: Response;
      if (fileToSend) {
        const form = new FormData();
        form.set("texto", msg);
        form.set("arquivo", fileToSend);
        res = await fetch("/api/suporte/mensagens", { method: "POST", body: form });
      } else {
        res = await fetch("/api/suporte/mensagens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: msg }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não enviou.");
        setTexto(msg);
        if (fileToSend) setArquivo(fileToSend);
        return;
      }
      setConversa(data.conversa);
      setMensagens(data.mensagens ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar.");
      setTexto(msg);
      if (fileToSend) setArquivo(fileToSend);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function escalar() {
    setLoading(true);
    setErro("");
    try {
      await garantirConversa();
      const res = await fetch("/api/suporte/escalar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não escalou.");
        return;
      }
      setConversa(data.conversa);
      setMensagens(data.mensagens ?? []);
    } catch {
      setErro("Falha ao transferir.");
    } finally {
      setLoading(false);
    }
  }

  async function encerrar() {
    if (!conversa) return;
    setLoading(true);
    try {
      const res = await fetch("/api/suporte/encerrar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não encerrou.");
        return;
      }
      setConversa(null);
      setMensagens([]);
    } finally {
      setLoading(false);
    }
  }

  const modo = conversa?.modo ?? "ia";
  const resolvido = modo === "resolvido";

  return (
    <div
      className={cn(display.variable, sans.variable)}
      style={{ fontFamily: "var(--font-suporte-sans), system-ui, sans-serif" }}
    >
      <div
        className={cn(
          "mx-auto flex h-[calc(100dvh-6.5rem)] max-w-5xl flex-col pt-5 transition duration-700 sm:h-[calc(100dvh-5.5rem)] sm:pt-7 lg:max-w-6xl",
          ativo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        )}
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[11px] font-medium uppercase text-at-link/90"
              style={{ letterSpacing: "0.38em" }}
            >
              Ajuda · OperaRoute
            </p>
            <h1
              className="mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-[0.95] tracking-tight text-at-primary"
              style={{ fontFamily: "var(--font-suporte-display), Georgia, serif" }}
            >
              Suporte
            </h1>
            <p className="mt-3 max-w-md text-[13px] text-at-muted">
              Fale primeiro com a assistente. Se ela não resolver, a conversa passa para a equipe.
            </p>
          </div>
          {isStaff && (
            <Link
              href="/suporte/inbox"
              className="inline-flex items-center gap-2 rounded-sm border border-white/[0.1] px-4 py-2.5 text-[13px] text-at-muted transition hover:border-at hover:text-at-primary"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Inbox
            </Link>
          )}
        </header>

        <div className="mt-6 h-px w-full bg-gradient-to-r from-[#c4a574]/45 via-white/10 to-transparent" />

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
          <span
            className={cn(
              "rounded-sm border px-2.5 py-1",
              !conversa && "border-at-soft text-at-primary/85",
              conversa && modo === "ia" && "border-at-soft text-at-primary/85",
              conversa && modo === "humano" && "border-[#c4a574]/40 text-at-link",
              conversa && modo === "resolvido" && "border-at-soft text-at-muted"
            )}
          >
            {!conversa && "Pronto para começar"}
            {conversa && modo === "ia" && "Com a IA"}
            {conversa && modo === "humano" && "Com a equipe"}
            {conversa && modo === "resolvido" && "Encerrado"}
          </span>
          {modo === "ia" && conversa && (
            <button
              type="button"
              onClick={() => void escalar()}
              disabled={loading}
              className="rounded-sm border border-at-soft px-2.5 py-1 text-at-muted transition hover:border-at hover:text-at-primary disabled:opacity-50"
            >
              Falar com humano
            </button>
          )}
          {conversa && !resolvido && (
            <button
              type="button"
              onClick={() => void encerrar()}
              disabled={loading}
              className="rounded-sm border border-at-soft px-2.5 py-1 text-at-muted transition hover:text-at-primary/85 disabled:opacity-50"
            >
              Encerrar
            </button>
          )}
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-sm border border-at bg-white/[0.02]">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {boot && (
              <p className="text-center text-[13px] text-at-muted">Carregando…</p>
            )}

            {!boot && mensagens.length === 0 && (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center space-y-5 py-10 text-center">
                <p
                  className="text-[clamp(1.35rem,2.5vw,1.75rem)] text-at-primary"
                  style={{ fontFamily: "var(--font-suporte-display), Georgia, serif" }}
                >
                  Como podemos ajudar?
                </p>
                <div className="flex max-w-2xl flex-wrap justify-center gap-2.5">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void enviar(s)}
                      className="rounded-sm border border-at-soft px-3.5 py-2 text-[13px] text-at-muted transition hover:border-[#c4a574]/30 hover:text-at-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m) => (
              <MensagemBolha key={m.id} m={m} />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[12px] text-at-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {modo === "ia" ? "Assistente pensando…" : "Enviando…"}
              </div>
            )}
            <div ref={fimRef} />
          </div>

          {erro && (
            <p className="border-t border-rose-500/20 bg-rose-500/5 px-4 py-2 text-[12px] text-rose-300">
              {erro}
            </p>
          )}

          <div className="border-t border-at p-3 sm:p-4">
            {arquivo && (
              <div className="mb-2.5 flex items-center gap-3 rounded-sm border border-at-soft bg-at-card-soft px-3 py-2">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-12 w-12 rounded-sm object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm border border-at-soft text-at-muted">
                    <Paperclip className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] text-at-primary">{arquivo.name}</p>
                  <p className="text-[11px] text-at-muted">
                    {(arquivo.size / 1024).toFixed(0)} KB · pronto para enviar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArquivo(null)}
                  className="rounded-sm p-1.5 text-at-muted hover:bg-white/[0.05] hover:text-at-primary"
                  aria-label="Remover anexo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
                onChange={(e) => {
                  escolherArquivo(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={loading || resolvido}
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-white/[0.1] text-at-muted transition hover:border-[#c4a574]/35 hover:text-at-link disabled:opacity-40"
                aria-label="Anexar foto ou arquivo"
                title="Anexar foto ou arquivo"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                ref={inputRef}
                rows={2}
                value={texto}
                disabled={loading || resolvido}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviar();
                  }
                }}
                placeholder={
                  resolvido
                    ? "Conversa encerrada — abra um novo envio"
                    : modo === "humano"
                      ? "Mensagem para a equipe…"
                      : "Pergunte à assistente…"
                }
                className="min-h-[3.25rem] max-h-40 flex-1 resize-none rounded-sm border border-at-soft bg-transparent px-3.5 py-3 text-[14px] text-at-primary placeholder:text-at-soft outline-none focus:border-[#c4a574]/35 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={loading || resolvido || (!texto.trim() && !arquivo)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-[#c4a574] text-[#1a140c] transition hover:bg-[#d4b884] disabled:opacity-40"
                aria-label="Enviar"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MensagemBolha({ m }: { m: SuporteMensagem }) {
  const isCliente = m.autor === "cliente";
  const isSistema = m.autor === "sistema";

  if (isSistema) {
    return (
      <p className="text-center text-[11px] tracking-wide text-at-muted">{m.corpo}</p>
    );
  }

  return (
    <div className={cn("flex gap-2.5", isCliente ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-at-soft",
          isCliente ? "text-at-link" : "text-at-muted"
        )}
      >
        {isCliente ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-sm px-3.5 py-2.5 text-[13px] leading-relaxed",
          isCliente
            ? "bg-[#c4a574]/15 text-at-primary"
            : m.autor === "staff"
              ? "border border-[#c4a574]/25 bg-at-card-soft text-at-primary"
              : "bg-at-card-soft text-at-primary/85"
        )}
      >
        {(m.autor === "staff" || m.autor === "ia") && (
          <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-at-muted">
            {m.autor === "staff" ? m.autor_nome ?? "Equipe" : "Assistente"}
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
    </div>
  );
}
