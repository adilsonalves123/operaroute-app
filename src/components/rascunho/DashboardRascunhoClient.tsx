"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Instrument_Serif, Outfit } from "next/font/google";
import { CalendarDays, Copy, Eraser, Link2, Loader2, MessageCircle, Pencil, Share2 } from "lucide-react";
import {
  criarLinkResumoRascunho,
  compartilharSomenteLink,
  type ResumoRascunhoSnapshot,
} from "@/lib/rascunho/compartilhar";
import { cn, formatCurrency, parseMoneyInput } from "@/lib/utils";
import { useAppTheme } from "@/components/layout/AppTheme";
import {
  analisePageBackground,
  appThemeToAnaliseVisual,
} from "@/lib/analise/analise-visual-theme";

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

function calcularResumoCaixa(
  valores: Record<string, string>,
  pontoIds: string[]
): { recebido: number; deixado: number; liquido: number } {
  let recebido = 0;
  let deixado = 0;
  for (const id of pontoIds) {
    const v = parseMoneyInput(valores[id] ?? "");
    if (v < -0.0001) deixado += Math.abs(v);
    else if (v > 0.0001) recebido += v;
  }
  return {
    recebido: round2(recebido),
    deixado: round2(deixado),
    liquido: round2(recebido - deixado),
  };
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
  empresaNome: string;
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

function dataCurta(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
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

/** Digita valores → Salvar → lista some e ficam só os números. */
export function DashboardRascunhoClient({ pontos, empresaNome }: Props) {
  const { theme: appTheme } = useAppTheme();
  const visualTema = appThemeToAnaliseVisual(appTheme);
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
  const [compartilhandoLink, setCompartilhandoLink] = useState(false);
  const [linkCompartilhamento, setLinkCompartilhamento] = useState<string | null>(null);

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
      setLinkCompartilhamento(null);
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

  const pixCalculado = totaisPagamentoCalculados.pix;
  const dinheiroCalculado = totaisPagamentoCalculados.dinheiro;

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
  const pix = pixEditadoManual ? parseMoneyInput(pixStr) : pixCalculado;
  const dinheiro = dinheiroEditadoManual ? parseMoneyInput(dinheiroStr) : dinheiroCalculado;
  const pixInputValue = pixEditadoManual
    ? pixStr
    : numberToMoneyInput(pixCalculado);
  const dinheiroInputValue = dinheiroEditadoManual
    ? dinheiroStr
    : numberToMoneyInput(dinheiroCalculado);
  const totalRecebido = pix + dinheiro;

  const resumoCaixa = useMemo(
    () => calcularResumoCaixa(valores, pontoIds),
    [valores, pontoIds]
  );

  function montarSnapshot(): ResumoRascunhoSnapshot {
    return {
      empresaNome,
      titulo: titulo.trim() || TITULO_PADRAO,
      dataISO: dataSelecionada,
      recebido: resumoCaixa.recebido,
      deixado: resumoCaixa.deixado,
      totalLiquido: resumoCaixa.liquido,
      pix,
      dinheiro,
      pontos: ranking.map((r) => ({
        nome: r.nome,
        valor: r.valor,
        forma: r.forma || undefined,
      })),
    };
  }

  async function garantirLinkCompartilhamento(): Promise<string> {
    if (linkCompartilhamento) return linkCompartilhamento;
    const url = await criarLinkResumoRascunho(montarSnapshot());
    setLinkCompartilhamento(url);
    return url;
  }

  async function gerarLinkCompartilhamento(): Promise<string> {
    return garantirLinkCompartilhamento();
  }

  async function copiarLink() {
    setFeedback(null);
    setCompartilhandoLink(true);
    try {
      const url = await garantirLinkCompartilhamento();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback("Link copiado.");
      } else {
        setFeedback(url);
      }
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Não foi possível copiar o link.");
    } finally {
      setCompartilhandoLink(false);
    }
  }

  async function compartilhar() {
    setFeedback(null);
    setCompartilhandoLink(true);
    try {
      const url = await gerarLinkCompartilhamento();
      const resultado = await compartilharSomenteLink(url);
      if (resultado === "copied") setFeedback("Link copiado.");
      else if (resultado === "shared") setFeedback("Link compartilhado.");
      else if (resultado === "failed") setFeedback("Não foi possível compartilhar.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFeedback(e instanceof Error ? e.message : "Não foi possível compartilhar.");
    } finally {
      setCompartilhandoLink(false);
    }
  }

  async function enviarWhatsApp() {
    setFeedback(null);
    setCompartilhandoLink(true);
    try {
      const url = await gerarLinkCompartilhamento();
      window.open(
        `https://wa.me/?text=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Não foi possível gerar o link.");
    } finally {
      setCompartilhandoLink(false);
    }
  }

  function setValor(id: string, raw: string) {
    setPixEditadoManual(false);
    setDinheiroEditadoManual(false);
    const limpo = sanitizarMoney(raw);
    setValores((prev) => {
      const next = { ...prev };
      if (!limpo.trim()) {
        delete next[id];
      } else {
        next[id] = limpo;
      }
      return next;
    });
  }

  function limpar() {
    setValores({});
    setMetaPorPonto({});
    setPixStr("");
    setDinheiroStr("");
    setPixEditadoManual(false);
    setDinheiroEditadoManual(false);
    setSalvo(false);
    setLinkCompartilhamento(null);
    setFeedback(null);
    setPuxouDia(false);
  }

  function salvar() {
    if (preenchidos === 0) {
      setFeedback("Preencha pelo menos um valor.");
      return;
    }
    setFeedback(null);
    setLinkCompartilhamento(null);
    setSalvo(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void (async () => {
      setCompartilhandoLink(true);
      try {
        const url = await criarLinkResumoRascunho(montarSnapshot());
        setLinkCompartilhamento(url);
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : "Não foi possível gerar o link.");
      } finally {
        setCompartilhandoLink(false);
      }
    })();
  }

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        !salvo && "pb-28",
        "font-[family-name:var(--font-rasc-sans)]"
      )}
    >
      <div className="relative mx-auto max-w-2xl space-y-10 pt-6 sm:pt-10">
        {!salvo ? (
          <>
            <header className="space-y-4 pt-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-at-link">
                OperaRoute
              </p>
              <h1
                className="text-[clamp(2.4rem,8vw,3.4rem)] font-normal leading-[0.95] tracking-tight text-at-primary"
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                Resumo
              </h1>
              <p className="max-w-md text-[14px] leading-relaxed text-at-muted">
                Escolha o dia — puxa quanto cada ponto mandou (Pix e Dinheiro).
                Os totais batem: soma dos pontos = Pix + Dinheiro.
              </p>

              <label className="block space-y-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.18em]",
                    visualTema === "claro" ? "text-stone-700" : "text-at-primary/80"
                  )}
                >
                  Dia da rota
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-fit">
                    <div
                      className={cn(
                        "rascunho-date-field flex items-center justify-center gap-2.5 rounded-xl border px-8 py-3",
                        visualTema === "claro"
                          ? "border-stone-300 bg-white shadow-[0_1px_3px_rgba(28,25,23,0.1)]"
                          : "border-at bg-at-card"
                      )}
                    >
                      <CalendarDays
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          visualTema === "claro" ? "text-[#78520a]" : "text-at-link"
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "text-[15px] font-semibold tabular-nums tracking-wide",
                          visualTema === "claro" ? "text-stone-900" : "text-at-primary"
                        )}
                      >
                        {dataCurta(dataSelecionada)}
                      </span>
                    </div>
                    <input
                      type="date"
                      value={dataSelecionada}
                      onChange={(e) => {
                        if (e.target.value) setDataSelecionada(e.target.value);
                      }}
                      aria-label="Dia da rota"
                      className={cn(
                        "rascunho-date-overlay absolute inset-0 z-10 cursor-pointer opacity-0",
                        visualTema === "claro" ? "[color-scheme:light]" : "[color-scheme:dark]"
                      )}
                    />
                  </div>
                  {carregandoDia ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-at-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Carregando…
                    </span>
                  ) : (
                    <>
                      {puxouDia ? (
                        <span className="text-[12px] text-at-link/90">
                          Coletas do dia importadas
                        </span>
                      ) : (
                        <span className="text-[12px] text-at-soft">
                          Nenhuma coleta neste dia
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void puxarDia(dataSelecionada)}
                        className="text-[12px] text-at-muted underline-offset-2 transition hover:text-at-primary/85 hover:underline"
                      >
                        Atualizar
                      </button>
                    </>
                  )}
                </div>
              </label>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-at pt-4 text-[12px] text-at-muted">
                <span className="capitalize text-at-muted">
                  {dataLabel(dataSelecionada)}
                </span>
                <span className="text-at-soft">·</span>
                <span>
                  {lista.length} ponto{lista.length === 1 ? "" : "s"} na folha
                </span>
                {preenchidos > 0 ? (
                  <>
                    <span className="text-at-soft">·</span>
                    <span className="tabular-nums text-at-link">
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
                className="w-full border-0 border-b border-at-soft bg-transparent px-0 py-2 text-[15px] text-at-primary placeholder:text-at-soft focus:border-at-link/50 focus:outline-none"
              />
            </header>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1.5 text-[12px] text-at-muted transition hover:text-at-primary/85"
              >
                <Eraser className="h-3.5 w-3.5" />
                Limpar folha
              </button>
            </div>

            <section>
              {!lista.length ? (
                <p className="text-[13px] text-at-muted">Nenhum ponto cadastrado.</p>
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
                              : "border-slate-600 bg-at-card"
                          )}
                        />
                        <div className="flex items-center gap-3">
                          <span className="w-5 shrink-0 text-[11px] tabular-nums text-at-soft">
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
                                "w-full border-b bg-transparent py-2 pr-1 text-right text-[15px] tabular-nums placeholder:text-at-soft focus:outline-none",
                                preenchido
                                  ? v < 0
                                    ? "border-rose-400/40 text-rose-300"
                                    : "border-[#c4a574]/40 text-at-primary"
                                  : "border-at-soft text-at-primary/85 focus:border-[#c4a574]/40"
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] text-at-primary/90">
                              {p.nome}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {p.status !== "ativo" ? (
                                <p className="text-[11px] capitalize text-at-soft">
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
            <section className="space-y-5 border-t border-at pt-8">
              <div className="space-y-3 rounded-lg border border-at bg-at-card-soft px-4 py-4">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-at-muted">Recebido</span>
                  <span className="tabular-nums text-at-primary">
                    {formatCurrency(resumoCaixa.recebido)}
                  </span>
                </div>
                {resumoCaixa.deixado > 0.009 ? (
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-at-muted">Deixado no ponto</span>
                    <span className="tabular-nums text-rose-300">
                      − {formatCurrency(resumoCaixa.deixado)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3 border-t border-at pt-3">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-at-muted">
                    Total líquido
                  </span>
                  <span
                    className="text-[1.35rem] tabular-nums text-at-link"
                    style={{
                      fontFamily: "var(--font-rasc-display), Georgia, serif",
                    }}
                  >
                    {formatCurrency(resumoCaixa.liquido)}
                  </span>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-at-muted">
                    Pix
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={pixInputValue}
                    onChange={(e) => {
                      setPixEditadoManual(true);
                      setPixStr(sanitizarMoney(e.target.value));
                    }}
                    className="w-full border-0 border-b border-at-soft bg-transparent py-2 text-[18px] tabular-nums text-at-primary placeholder:text-at-soft focus:border-at-link/50 focus:outline-none"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-at-muted">
                    Dinheiro
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={dinheiroInputValue}
                    onChange={(e) => {
                      setDinheiroEditadoManual(true);
                      setDinheiroStr(sanitizarMoney(e.target.value));
                    }}
                    className="w-full border-0 border-b border-at-soft bg-transparent py-2 text-[18px] tabular-nums text-at-primary placeholder:text-at-soft focus:border-at-link/50 focus:outline-none"
                  />
                </label>
              </div>
              <p className="text-[13px] text-at-muted">
                {preenchidos === 0 ? (
                  "Nenhum ponto com valor ainda"
                ) : (
                  <>
                    <span className="tabular-nums text-at-primary">
                      {formatCurrency(resumoCaixa.liquido)}
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

            <div className="fixed inset-x-0 bottom-16 z-30 border-t border-at bg-at-sticky/95 px-4 py-3 backdrop-blur-md lg:bottom-0">
              <div className="mx-auto max-w-2xl">
                <button
                  type="button"
                  onClick={salvar}
                  className={cn(
                    "flex w-full items-center justify-center rounded-lg px-4 py-3.5 text-[14px] font-semibold tracking-wide transition hover:brightness-110",
                    visualTema === "claro"
                      ? "bg-at-primary text-at-card"
                      : "bg-[#c4a574] text-[#0a0e16]"
                  )}
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
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-at-link/90">
                OperaRoute · fechamento
              </p>
              <h1
                className="text-[clamp(2.2rem,7vw,3rem)] font-normal leading-[0.95] tracking-tight text-at-primary"
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                {titulo.trim() || TITULO_PADRAO}
              </h1>
              <p className="capitalize text-[13px] text-at-muted">
                {dataLabel(dataSelecionada)}
              </p>
              <div
                className="h-px w-full origin-left bg-gradient-to-r from-[#c4a574]/55 via-white/10 to-transparent"
                style={{ animation: "dashLine 0.9s 0.15s ease-out both" }}
              />
            </header>

            <section className="space-y-3">
              <div className="flex justify-between text-[13px] text-at-muted">
                <span>Recebido</span>
                <span className="tabular-nums text-at-primary/85">
                  {formatCurrency(resumoCaixa.recebido)}
                </span>
              </div>
              {resumoCaixa.deixado > 0.009 ? (
                <div className="flex justify-between text-[13px] text-at-muted">
                  <span>Deixado no ponto</span>
                  <span className="tabular-nums text-rose-300">
                    − {formatCurrency(resumoCaixa.deixado)}
                  </span>
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-at-muted">
                Total líquido
              </p>
              <p
                className={cn(
                  "text-[clamp(2.8rem,10vw,4rem)] font-normal leading-none tracking-tight tabular-nums",
                  resumoCaixa.liquido < 0 ? "text-rose-300" : "text-at-primary"
                )}
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                {formatCurrency(resumoCaixa.liquido)}
              </p>
              <p className="text-[13px] text-at-muted">
                {preenchidos} ponto{preenchidos === 1 ? "" : "s"}
                {preenchidos > 0 ? (
                  <>
                    {" "}
                    · média{" "}
                    <span className="tabular-nums text-at-muted">
                      {formatCurrency(media)}
                    </span>
                  </>
                ) : null}
              </p>
            </section>

            <section className="grid gap-6 border-y border-at py-6 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-at-muted">
                  Pix
                </p>
                <p
                  className="mt-1 text-[1.75rem] tabular-nums leading-none text-at-primary"
                  style={{
                    fontFamily: "var(--font-rasc-display), Georgia, serif",
                  }}
                >
                  {formatCurrency(pix)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-at-muted">
                  Dinheiro
                </p>
                <p
                  className="mt-1 text-[1.75rem] tabular-nums leading-none text-at-primary"
                  style={{
                    fontFamily: "var(--font-rasc-display), Georgia, serif",
                  }}
                >
                  {formatCurrency(dinheiro)}
                </p>
              </div>
            </section>

            <section className="space-y-5">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-at-muted">
                Por ponto
              </h2>
              <ol className="space-y-4">
                {ranking.map((r, i) => {
                  const width = Math.max(6, (Math.abs(r.valor) / maxAbs) * 100);
                  return (
                    <li key={r.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[14px] text-at-primary/85">
                          <span className="mr-2 tabular-nums text-at-soft">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {r.nome}
                          {r.forma ? (
                            <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-at-muted">
                              {r.forma}
                            </span>
                          ) : null}
                        </p>
                        <p
                          className={cn(
                            "shrink-0 text-[15px] tabular-nums",
                            r.valor < 0 ? "text-rose-300" : "text-at-primary"
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

            <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-at pt-6 text-[13px]">
              <div className="w-full space-y-3">
                <p className="text-[11px] text-at-soft">
                  WhatsApp e compartilhar enviam só o link da página web.
                </p>
                {compartilhandoLink && !linkCompartilhamento ? (
                  <p className="inline-flex items-center gap-2 text-[12px] text-at-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gerando link…
                  </p>
                ) : linkCompartilhamento ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-at-soft bg-at-card-soft px-3 py-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-at-link/80" />
                      <a
                        href={linkCompartilhamento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-[12px] text-at-link underline-offset-2 hover:underline"
                      >
                        {linkCompartilhamento}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copiarLink()}
                      disabled={compartilhandoLink}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-at-soft px-3 py-2 text-[12px] text-at-primary/85 transition hover:border-at hover:text-white disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar link
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void enviarWhatsApp()}
                disabled={compartilhandoLink}
                className="inline-flex items-center gap-2 text-at-link transition hover:text-at-link disabled:opacity-50"
              >
                {compartilhandoLink ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="h-3.5 w-3.5" />
                )}
                WhatsApp (link)
              </button>
              <button
                type="button"
                onClick={() => void compartilhar()}
                disabled={compartilhandoLink}
                className="inline-flex items-center gap-2 text-at-muted transition hover:text-at-primary/90 disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartilhar link
              </button>
              <button
                type="button"
                onClick={() => {
                  setSalvo(false);
                  setLinkCompartilhamento(null);
                  setFeedback(null);
                }}
                className="inline-flex items-center gap-2 text-at-muted transition hover:text-at-primary/90"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar folha
              </button>
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-2 text-at-muted transition hover:text-at-primary/85"
              >
                <Eraser className="h-3.5 w-3.5" />
                Limpar
              </button>
            </div>
            {feedback ? (
              <p className="text-[12px] text-at-muted">{feedback}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
