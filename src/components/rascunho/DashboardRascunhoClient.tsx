"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Instrument_Serif, Outfit } from "next/font/google";
import { CalendarDays, Eraser, Loader2, MessageCircle, Pencil, Share2 } from "lucide-react";
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

type PontoMetaRascunho = {
  pix: number;
  dinheiro: number;
  forma: "pix" | "dinheiro" | "misto" | null;
  /** Valor original importado da coleta (base para repartir ao editar). */
  valorImportado: number;
};

const TITULO_PADRAO = "Resumo";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Reparte o valor editado entre Pix e Dinheiro conforme a forma da coleta. */
function repartirValorPorForma(
  valor: number,
  meta?: PontoMetaRascunho
): { pix: number; dinheiro: number } {
  if (Math.abs(valor) < 0.0001) return { pix: 0, dinheiro: 0 };

  const forma = meta?.forma;
  const origPix = Math.abs(meta?.pix ?? 0);
  const origDin = Math.abs(meta?.dinheiro ?? 0);
  const origValor = Math.abs(meta?.valorImportado ?? origPix + origDin);

  if (forma === "pix") return { pix: valor, dinheiro: 0 };
  if (forma === "dinheiro") return { pix: 0, dinheiro: valor };

  const base = origPix + origDin;
  if (base > 0.0001) {
    const pix = round2(valor * (origPix / base));
    return { pix, dinheiro: round2(valor - pix) };
  }
  if (origValor > 0.0001 && (origPix > 0.0001 || origDin > 0.0001)) {
    const pix = round2(valor * (origPix / origValor));
    return { pix, dinheiro: round2(valor - pix) };
  }

  return { pix: valor, dinheiro: 0 };
}

function calcularPixDinheiroDosPontos(
  valores: Record<string, string>,
  metaPorPonto: Record<string, PontoMetaRascunho>,
  pontoIds: string[]
): { pix: number; dinheiro: number } {
  let pix = 0;
  let dinheiro = 0;
  for (const id of pontoIds) {
    const valor = parseMoneyInput(valores[id] ?? "");
    if (Math.abs(valor) < 0.0001) continue;
    const partes = repartirValorPorForma(valor, metaPorPonto[id]);
    pix += partes.pix;
    dinheiro += partes.dinheiro;
  }
  return { pix: round2(pix), dinheiro: round2(dinheiro) };
}

function formaLabel(forma: PontoMetaRascunho["forma"]): string {
  if (forma === "pix") return "Pix";
  if (forma === "dinheiro") return "Dinheiro";
  if (forma === "misto") return "Pix + Dinheiro";
  return "";
}

type Props = {
  pontos: PontoRascunho[];
};

function hojeISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dataLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function numberToMoneyInput(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.0001) return "";
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n < 0 ? `-${formatted}` : formatted;
}

function sanitizarMoney(raw: string): string {
  const limpo = raw.replace(/[^\d,.\-]/g, "");
  const negativo = limpo.trimStart().startsWith("-");
  const resto = limpo.split("-").join("").replace(/-/g, "");
  return negativo ? `-${resto}` : resto;
}

function montarTextoResumo(opts: {
  titulo: string;
  dataISO: string;
  total: number;
  preenchidos: number;
  pix: number;
  dinheiro: number;
  ranking: { nome: string; valor: number; forma?: string }[];
}): string {
  const linhas = [
    `*${opts.titulo || TITULO_PADRAO} — OperaRoute*`,
    dataLabel(opts.dataISO),
    "",
    `Total recebido: *${formatCurrency(opts.total)}*`,
    `Pix: ${formatCurrency(opts.pix)} · Dinheiro: ${formatCurrency(opts.dinheiro)}`,
    `Pontos: ${opts.preenchidos}`,
  ];

  if (opts.ranking.length) {
    linhas.push("", "*Pontos:*");
    opts.ranking.forEach((r, i) => {
      const forma = r.forma ? ` · ${r.forma}` : "";
      linhas.push(`${i + 1}. ${r.nome}: ${formatCurrency(r.valor)}${forma}`);
    });
  }

  return linhas.join("\n");
}

/** Digita valores → Salvar → lista some e ficam só os números. */
export function DashboardRascunhoClient({ pontos }: Props) {
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [metaPorPonto, setMetaPorPonto] = useState<Record<string, PontoMetaRascunho>>({});
  const [pixStr, setPixStr] = useState("");
  const [dinheiroStr, setDinheiroStr] = useState("");
  const [pixEditadoManual, setPixEditadoManual] = useState(false);
  const [dinheiroEditadoManual, setDinheiroEditadoManual] = useState(false);
  const [titulo, setTitulo] = useState(TITULO_PADRAO);
  const [salvo, setSalvo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [carregandoDia, setCarregandoDia] = useState(false);
  const [puxouDia, setPuxouDia] = useState(false);

  const puxarDia = useCallback(async (dataISO: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return;
    setCarregandoDia(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/rascunho/dia?data=${encodeURIComponent(dataISO)}`);
      const body = (await res.json()) as {
        error?: string;
        porPonto?: Record<
          string,
          { valor: number; pix: number; dinheiro: number; forma: PontoMetaRascunho["forma"] }
        >;
        pix?: number;
        dinheiro?: number;
      };
      if (!res.ok) {
        setFeedback(body.error ?? "Não foi possível carregar o dia.");
        return;
      }

      const nextValores: Record<string, string> = {};
      const nextMeta: Record<string, PontoMetaRascunho> = {};
      for (const [pontoId, item] of Object.entries(body.porPonto ?? {})) {
        nextValores[pontoId] = numberToMoneyInput(item.valor);
        nextMeta[pontoId] = {
          pix: item.pix,
          dinheiro: item.dinheiro,
          forma: item.forma,
          valorImportado: item.valor,
        };
      }
      setValores(nextValores);
      setMetaPorPonto(nextMeta);
      setPixEditadoManual(false);
      setDinheiroEditadoManual(false);
      setPixStr(numberToMoneyInput(body.pix ?? 0));
      setDinheiroStr(numberToMoneyInput(body.dinheiro ?? 0));
      setPuxouDia(Object.keys(body.porPonto ?? {}).length > 0);
      setSalvo(false);
    } catch {
      setFeedback("Não foi possível carregar o dia.");
    } finally {
      setCarregandoDia(false);
    }
  }, []);

  useEffect(() => {
    void puxarDia(dataSelecionada);
  }, [dataSelecionada, puxarDia]);

  const lista = useMemo(
    () => [...pontos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [pontos]
  );

  const pontoIds = useMemo(() => lista.map((p) => p.id), [lista]);

  const totaisPagamentoCalculados = useMemo(
    () => calcularPixDinheiroDosPontos(valores, metaPorPonto, pontoIds),
    [valores, metaPorPonto, pontoIds]
  );

  useEffect(() => {
    if (pixEditadoManual) return;
    setPixStr(numberToMoneyInput(totaisPagamentoCalculados.pix));
  }, [totaisPagamentoCalculados.pix, pixEditadoManual]);

  useEffect(() => {
    if (dinheiroEditadoManual) return;
    setDinheiroStr(numberToMoneyInput(totaisPagamentoCalculados.dinheiro));
  }, [totaisPagamentoCalculados.dinheiro, dinheiroEditadoManual]);

  const ranking = useMemo(() => {
    return lista
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        valor: parseMoneyInput(valores[p.id] ?? ""),
        forma: formaLabel(metaPorPonto[p.id]?.forma ?? null),
      }))
      .filter((r) => Math.abs(r.valor) > 0.0001)
      .sort((a, b) => b.valor - a.valor);
  }, [lista, valores, metaPorPonto]);

  const total = useMemo(
    () => ranking.reduce((s, r) => s + r.valor, 0),
    [ranking]
  );
  const preenchidos = ranking.length;
  const media = preenchidos > 0 ? total / preenchidos : 0;
  const maxAbs = Math.max(...ranking.map((r) => Math.abs(r.valor)), 1);
  const pix = parseMoneyInput(pixStr);
  const dinheiro = parseMoneyInput(dinheiroStr);
  const totalRecebido = pix + dinheiro;

  function setValor(id: string, raw: string) {
    setPixEditadoManual(false);
    setDinheiroEditadoManual(false);
    setValores((prev) => ({
      ...prev,
      [id]: sanitizarMoney(raw),
    }));
  }

  function limpar() {
    setValores({});
    setMetaPorPonto({});
    setPixStr("");
    setDinheiroStr("");
    setPixEditadoManual(false);
    setDinheiroEditadoManual(false);
    setSalvo(false);
    setFeedback(null);
    setPuxouDia(false);
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
    titulo: titulo.trim() || TITULO_PADRAO,
    dataISO: dataSelecionada,
    total: totalRecebido,
    preenchidos,
    pix,
    dinheiro,
    ranking,
  });

  async function compartilhar() {
    setFeedback(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: titulo.trim() || TITULO_PADRAO,
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
                Resumo
              </h1>
              <p className="max-w-md text-[14px] leading-relaxed text-slate-400">
                Escolha o dia — puxa quanto cada ponto mandou (Pix e Dinheiro).
                Os totais batem: soma dos pontos = Pix + Dinheiro.
              </p>

              <label className="block space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Dia da rota
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c4a574]/80" />
                    <input
                      type="date"
                      value={dataSelecionada}
                      onChange={(e) => {
                        if (e.target.value) setDataSelecionada(e.target.value);
                      }}
                      className="w-full min-w-[11rem] border-0 border-b border-white/15 bg-transparent py-2 pl-6 pr-1 text-[15px] text-[#f4efe6] [color-scheme:dark] focus:border-[#c4a574]/50 focus:outline-none"
                    />
                  </div>
                  {carregandoDia ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando…
                    </span>
                  ) : (
                    <>
                      {puxouDia ? (
                        <span className="text-[12px] text-[#c4a574]/90">
                          Coletas do dia importadas
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-600">
                          Nenhuma coleta neste dia
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void puxarDia(dataSelecionada)}
                        className="text-[12px] text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
                      >
                        Atualizar
                      </button>
                    </>
                  )}
                </div>
              </label>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-white/[0.08] pt-4 text-[12px] text-slate-500">
                <span className="capitalize text-slate-400">
                  {dataLabel(dataSelecionada)}
                </span>
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 transition hover:text-slate-300"
              >
                <Eraser className="h-3.5 w-3.5" />
                Limpar folha
              </button>
            </div>

            <section>
              {!lista.length ? (
                <p className="text-[13px] text-slate-500">Nenhum ponto cadastrado.</p>
              ) : (
                <ol className="relative space-y-0 border-l border-[#c4a574]/25 pl-5">
                  {lista.map((p, idx) => {
                    const v = parseMoneyInput(valores[p.id] ?? "");
                    const preenchido = Math.abs(v) > 0.0001;
                    const meta = metaPorPonto[p.id];
                    const forma = formaLabel(meta?.forma ?? null);
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
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {p.status !== "ativo" ? (
                                <p className="text-[11px] capitalize text-slate-600">
                                  {p.status}
                                </p>
                              ) : null}
                              {forma ? (
                                <p
                                  className={cn(
                                    "text-[10px] font-medium uppercase tracking-[0.14em]",
                                    meta?.forma === "pix"
                                      ? "text-emerald-400/85"
                                      : meta?.forma === "dinheiro"
                                        ? "text-amber-300/85"
                                        : "text-sky-300/85"
                                  )}
                                >
                                  {forma}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* Pix / Dinheiro — depois da lista, antes de salvar */}
            <section className="space-y-5 border-t border-white/[0.08] pt-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Pix
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={pixStr}
                    onChange={(e) => {
                      setPixEditadoManual(true);
                      setPixStr(sanitizarMoney(e.target.value));
                    }}
                    className="w-full border-0 border-b border-white/15 bg-transparent py-2 text-[18px] tabular-nums text-[#f4efe6] placeholder:text-slate-700 focus:border-[#c4a574]/50 focus:outline-none"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Dinheiro
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={dinheiroStr}
                    onChange={(e) => {
                      setDinheiroEditadoManual(true);
                      setDinheiroStr(sanitizarMoney(e.target.value));
                    }}
                    className="w-full border-0 border-b border-white/15 bg-transparent py-2 text-[18px] tabular-nums text-[#f4efe6] placeholder:text-slate-700 focus:border-[#c4a574]/50 focus:outline-none"
                  />
                </label>
              </div>
              <p className="text-[13px] text-slate-500">
                {preenchidos === 0 ? (
                  "Nenhum ponto com valor ainda"
                ) : (
                  <>
                    <span className="tabular-nums text-[#f4efe6]">
                      {formatCurrency(totalRecebido)}
                    </span>
                    {" · "}
                    {preenchidos} ponto{preenchidos === 1 ? "" : "s"}
                  </>
                )}
              </p>
              {feedback ? (
                <p className="text-[12px] text-rose-400">{feedback}</p>
              ) : null}
            </section>

            <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#c4a574]/20 bg-[#0a0e16]/92 px-4 py-3 backdrop-blur-md lg:bottom-0">
              <div className="mx-auto max-w-2xl">
                <button
                  type="button"
                  onClick={salvar}
                  className="flex w-full items-center justify-center rounded-lg bg-[#c4a574] px-4 py-3.5 text-[14px] font-semibold tracking-wide text-[#0a0e16] transition hover:brightness-110"
                >
                  Fechar resumo
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
                {titulo.trim() || TITULO_PADRAO}
              </h1>
              <p className="capitalize text-[13px] text-slate-500">
                {dataLabel(dataSelecionada)}
              </p>
              <div
                className="h-px w-full origin-left bg-gradient-to-r from-[#c4a574]/55 via-white/10 to-transparent"
                style={{ animation: "dashLine 0.9s 0.15s ease-out both" }}
              />
            </header>

            <section className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                Total recebido
              </p>
              <p
                className={cn(
                  "text-[clamp(2.8rem,10vw,4rem)] font-normal leading-none tracking-tight tabular-nums",
                  totalRecebido < 0 ? "text-rose-300" : "text-[#f4efe6]"
                )}
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                {formatCurrency(totalRecebido)}
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

            <section className="grid gap-6 border-y border-white/[0.08] py-6 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Pix
                </p>
                <p
                  className="mt-1 text-[1.75rem] tabular-nums leading-none text-[#f4efe6]"
                  style={{
                    fontFamily: "var(--font-rasc-display), Georgia, serif",
                  }}
                >
                  {formatCurrency(pix)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Dinheiro
                </p>
                <p
                  className="mt-1 text-[1.75rem] tabular-nums leading-none text-[#f4efe6]"
                  style={{
                    fontFamily: "var(--font-rasc-display), Georgia, serif",
                  }}
                >
                  {formatCurrency(dinheiro)}
                </p>
              </div>
              <div className="sm:col-span-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Recebido
                </p>
                <p
                  className="mt-1 text-[1.75rem] tabular-nums leading-none text-[#c4a574]"
                  style={{
                    fontFamily: "var(--font-rasc-display), Georgia, serif",
                  }}
                >
                  {formatCurrency(totalRecebido)}
                </p>
              </div>
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
                          {r.forma ? (
                            <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                              {r.forma}
                            </span>
                          ) : null}
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
