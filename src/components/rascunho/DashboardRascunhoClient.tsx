"use client";

import { useMemo, useState } from "react";
import { Instrument_Serif, Outfit } from "next/font/google";
import { Eraser, MessageCircle, Pencil, Share2 } from "lucide-react";
import { whatsAppUrlRota } from "@/lib/rotas/whatsapp-rota";
import { cn, formatCurrency, parseMoneyInput } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-rasc-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-rasc-sans",
});

export type PontoRascunho = {
  id: string;
  nome: string;
  status: string;
};

type Props = {
  pontos: PontoRascunho[];
};

function hojeLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function montarTextoResumo(opts: {
  titulo: string;
  total: number;
  preenchidos: number;
  ranking: { nome: string; valor: number }[];
}): string {
  const linhas = [
    `*${opts.titulo || "Dashboard"} — OperaRoute*`,
    hojeLabel(),
    "",
    `Total: *${formatCurrency(opts.total)}*`,
    `Pontos: ${opts.preenchidos}`,
  ];

  if (opts.ranking.length) {
    linhas.push("", "*Pontos:*");
    opts.ranking.forEach((r, i) => {
      linhas.push(`${i + 1}. ${r.nome}: ${formatCurrency(r.valor)}`);
    });
  }

  return linhas.join("\n");
}

/** Digita valores → Salvar → lista some e ficam só os números. */
export function DashboardRascunhoClient({ pontos }: Props) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [titulo, setTitulo] = useState("Dashboard");
  const [salvo, setSalvo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const lista = useMemo(
    () => [...pontos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [pontos]
  );

  const ranking = useMemo(() => {
    return lista
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        valor: parseMoneyInput(valores[p.id] ?? ""),
      }))
      .filter((r) => Math.abs(r.valor) > 0.0001)
      .sort((a, b) => b.valor - a.valor);
  }, [lista, valores]);

  const total = useMemo(
    () => ranking.reduce((s, r) => s + r.valor, 0),
    [ranking]
  );
  const preenchidos = ranking.length;
  const media = preenchidos > 0 ? total / preenchidos : 0;
  const maxAbs = Math.max(...ranking.map((r) => Math.abs(r.valor)), 1);

  function setValor(id: string, raw: string) {
    const limpo = raw.replace(/[^\d,.\-]/g, "");
    const negativo = limpo.trimStart().startsWith("-");
    const resto = limpo.split("-").join("").replace(/-/g, "");
    setValores((prev) => ({
      ...prev,
      [id]: negativo ? `-${resto}` : resto,
    }));
  }

  function limpar() {
    setValores({});
    setSalvo(false);
    setFeedback(null);
  }

  function salvar() {
    if (preenchidos === 0) {
      setFeedback("Preencha pelo menos um valor.");
      return;
    }
    setFeedback(null);
    setSalvo(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const texto = montarTextoResumo({
    titulo: titulo.trim() || "Dashboard",
    total,
    preenchidos,
    ranking,
  });

  async function compartilhar() {
    setFeedback(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: titulo.trim() || "Dashboard",
          text: texto,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        setFeedback("Resumo copiado.");
        return;
      }
      setFeedback("Não foi possível compartilhar.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFeedback("Não foi possível compartilhar.");
    }
  }

  function enviarWhatsApp() {
    window.open(whatsAppUrlRota(null, texto), "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 min-h-[60vh] px-4 pb-8 sm:mx-0 sm:px-0",
        !salvo && "pb-28",
        "font-[family-name:var(--font-rasc-sans)]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[380px] opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 15% -5%, rgba(196,165,116,0.16), transparent 55%), radial-gradient(ellipse 45% 35% at 95% 5%, rgba(148,163,184,0.08), transparent 50%)",
        }}
      />

      <div className="relative mx-auto max-w-2xl space-y-10">
        {!salvo ? (
          <>
            <header className="space-y-4 pt-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#c4a574]/90">
                OperaRoute
              </p>
              <h1
                className="text-[clamp(2.4rem,8vw,3.4rem)] font-normal leading-[0.95] tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                Dashboard
              </h1>
              <p className="max-w-md text-[14px] leading-relaxed text-slate-400">
                Folha da rota: anote o valor de cada ponto. Use{" "}
                <span className="text-slate-300">-</span> se for negativo. Ao
                salvar, a lista some — fica o fechamento.
              </p>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-white/[0.08] pt-4 text-[12px] text-slate-500">
                <span className="capitalize text-slate-400">{hojeLabel()}</span>
                <span className="text-slate-700">·</span>
                <span>
                  {lista.length} ponto{lista.length === 1 ? "" : "s"} na folha
                </span>
                {preenchidos > 0 ? (
                  <>
                    <span className="text-slate-700">·</span>
                    <span className="tabular-nums text-[#c4a574]">
                      {preenchidos} preenchido{preenchidos === 1 ? "" : "s"}
                    </span>
                  </>
                ) : null}
              </div>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Nome do fechamento (opcional)"
                className="w-full border-0 border-b border-white/15 bg-transparent px-0 py-2 text-[15px] text-[#f4efe6] placeholder:text-slate-600 focus:border-[#c4a574]/50 focus:outline-none"
              />
            </header>

            {preenchidos > 0 ? (
              <div className="flex items-end justify-between gap-4 border-b border-white/[0.06] pb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Parcial
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[1.75rem] tabular-nums leading-none",
                      total < 0 ? "text-rose-300" : "text-[#f4efe6]"
                    )}
                    style={{
                      fontFamily: "var(--font-rasc-display), Georgia, serif",
                    }}
                  >
                    {formatCurrency(total)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={limpar}
                  className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 transition hover:text-slate-300"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Limpar folha
                </button>
              </div>
            ) : null}

            <section>
              {!lista.length ? (
                <p className="text-[13px] text-slate-500">Nenhum ponto cadastrado.</p>
              ) : (
                <ol className="relative space-y-0 border-l border-[#c4a574]/25 pl-5">
                  {lista.map((p, idx) => {
                    const v = parseMoneyInput(valores[p.id] ?? "");
                    const preenchido = Math.abs(v) > 0.0001;
                    return (
                      <li key={p.id} className="relative pb-5 last:pb-0">
                        <span
                          className={cn(
                            "absolute -left-[1.4rem] top-3 h-2.5 w-2.5 rounded-full border",
                            preenchido
                              ? "border-[#c4a574] bg-[#c4a574]"
                              : "border-slate-600 bg-[#0a0e16]"
                          )}
                        />
                        <div className="flex items-center gap-3">
                          <span className="w-5 shrink-0 text-[11px] tabular-nums text-slate-600">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div className="relative w-[7.75rem] shrink-0">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="—"
                              value={valores[p.id] ?? ""}
                              onChange={(e) => setValor(p.id, e.target.value)}
                              className={cn(
                                "w-full border-b bg-transparent py-2 pr-1 text-right text-[15px] tabular-nums placeholder:text-slate-700 focus:outline-none",
                                preenchido
                                  ? v < 0
                                    ? "border-rose-400/40 text-rose-300"
                                    : "border-[#c4a574]/40 text-[#f4efe6]"
                                  : "border-white/10 text-slate-300 focus:border-[#c4a574]/40"
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] text-slate-200">
                              {p.nome}
                            </p>
                            {p.status !== "ativo" ? (
                              <p className="text-[11px] capitalize text-slate-600">
                                {p.status}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {feedback ? (
                <p className="mt-4 text-[12px] text-rose-400">{feedback}</p>
              ) : null}
            </section>

            <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#c4a574]/20 bg-[#0a0e16]/92 px-4 py-3 backdrop-blur-md lg:bottom-0">
              <div className="mx-auto max-w-2xl">
                <button
                  type="button"
                  onClick={salvar}
                  className="flex w-full items-center justify-center rounded-lg bg-[#c4a574] px-4 py-3.5 text-[14px] font-semibold tracking-wide text-[#0a0e16] transition hover:brightness-110"
                >
                  Fechar dashboard
                </button>
              </div>
            </div>
          </>
        ) : (
          <div
            className="space-y-10 pt-2"
            style={{ animation: "dashRise 0.55s ease-out both" }}
          >
            <style>{`
              @keyframes dashRise {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes dashLine {
                from { transform: scaleX(0); }
                to { transform: scaleX(1); }
              }
            `}</style>

            <header className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#c4a574]/90">
                OperaRoute · fechamento
              </p>
              <h1
                className="text-[clamp(2.2rem,7vw,3rem)] font-normal leading-[0.95] tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                {titulo.trim() || "Dashboard"}
              </h1>
              <p className="capitalize text-[13px] text-slate-500">{hojeLabel()}</p>
              <div
                className="h-px w-full origin-left bg-gradient-to-r from-[#c4a574]/55 via-white/10 to-transparent"
                style={{ animation: "dashLine 0.9s 0.15s ease-out both" }}
              />
            </header>

            <section className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Total da rota
              </p>
              <p
                className={cn(
                  "text-[clamp(2.8rem,10vw,4rem)] font-normal leading-none tracking-tight tabular-nums",
                  total < 0 ? "text-rose-300" : "text-[#f4efe6]"
                )}
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                {formatCurrency(total)}
              </p>
              <p className="text-[13px] text-slate-500">
                {preenchidos} ponto{preenchidos === 1 ? "" : "s"}
                {preenchidos > 0 ? (
                  <>
                    {" "}
                    · média{" "}
                    <span className="tabular-nums text-slate-400">
                      {formatCurrency(media)}
                    </span>
                  </>
                ) : null}
              </p>
            </section>

            <section className="space-y-5">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Por ponto
              </h2>
              <ol className="space-y-4">
                {ranking.map((r, i) => {
                  const width = Math.max(6, (Math.abs(r.valor) / maxAbs) * 100);
                  return (
                    <li key={r.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[14px] text-slate-300">
                          <span className="mr-2 tabular-nums text-slate-600">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {r.nome}
                        </p>
                        <p
                          className={cn(
                            "shrink-0 text-[15px] tabular-nums",
                            r.valor < 0 ? "text-rose-300" : "text-[#f4efe6]"
                          )}
                          style={{
                            fontFamily:
                              "var(--font-rasc-display), Georgia, serif",
                          }}
                        >
                          {formatCurrency(r.valor)}
                        </p>
                      </div>
                      <div className="h-[3px] w-full overflow-hidden bg-white/[0.05]">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            r.valor < 0 ? "bg-rose-400/50" : "bg-[#c4a574]/70"
                          )}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-white/[0.08] pt-6 text-[13px]">
              <button
                type="button"
                onClick={enviarWhatsApp}
                className="inline-flex items-center gap-2 text-[#c4a574] transition hover:text-[#e8d5b0]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => void compartilhar()}
                className="inline-flex items-center gap-2 text-slate-400 transition hover:text-slate-200"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSalvo(false);
                  setFeedback(null);
                }}
                className="inline-flex items-center gap-2 text-slate-400 transition hover:text-slate-200"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar folha
              </button>
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-2 text-slate-500 transition hover:text-slate-300"
              >
                <Eraser className="h-3.5 w-3.5" />
                Limpar
              </button>
            </div>
            {feedback ? (
              <p className="text-[12px] text-slate-400">{feedback}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
