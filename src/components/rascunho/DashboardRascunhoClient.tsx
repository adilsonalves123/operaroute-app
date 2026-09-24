"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Instrument_Serif, Outfit } from "next/font/google";
import { CalendarDays, Copy, Eraser, Link2, Loader2, MessageCircle, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import {
  criarLinkResumoRascunho,
  compartilharSomenteLink,
  type ResumoRascunhoSnapshot,
} from "@/lib/rascunho/compartilhar";
import { cn, formatCurrency, formatMoneyInputOnBlur, parseMoneyInput } from "@/lib/utils";

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

type DividaLinha = { id: string; nome: string; valor: string };

function novaDividaLinha(): DividaLinha {
  return {
    id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    nome: "",
    valor: "",
  };
}

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

type OperadorVisao = { id: string; nome: string };

function DestinosPainelOperador({
  operadores,
  selecionados,
  publicando,
  onToggle,
  onTodos,
  onNenhum,
  onEnviar,
}: {
  operadores: OperadorVisao[];
  selecionados: string[];
  publicando: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onTodos: () => void;
  onNenhum: () => void;
  onEnviar: () => void;
}) {
  if (operadores.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-white/10 p-4">
        <p className="text-sm font-medium text-[var(--shell-text)]">Enviar para operadores</p>
        <p className="text-xs leading-relaxed text-slate-400">
          Ninguém está no painel restrito ainda. Marque os operadores em Equipe → Painel restrito.
        </p>
      </div>
    );
  }

  const n = selecionados.length;
  const label =
    n === 0
      ? "Marque um ou mais operadores"
      : n === 1
        ? `Enviar para ${operadores.find((o) => o.id === selecionados[0])?.nome ?? "1 operador"}`
        : `Enviar para ${n} operadores`;

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
      <p className="text-sm font-medium text-amber-100/90">Enviar para operadores</p>
      <p className="text-xs leading-relaxed text-slate-400">
        Salvar mantém a folha só para você. Aqui você escolhe quem recebe no painel — um, vários
        ou todos, no mesmo envio. A coleta real não muda.
      </p>
      <div className="flex gap-3 text-[13px]">
        <button type="button" onClick={onTodos} className="text-[#c4a574] hover:underline">
          Marcar todos
        </button>
        <button type="button" onClick={onNenhum} className="text-slate-500 hover:underline">
          Limpar seleção
        </button>
      </div>
      <div className="space-y-1.5">
        {operadores.map((op) => {
          const on = selecionados.includes(op.id);
          return (
            <label
              key={op.id}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => onToggle(op.id, e.target.checked)}
              />
              {op.nome}
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onEnviar}
        disabled={publicando || n === 0}
        className="rounded-lg bg-[#c4a574] px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
      >
        {publicando ? "Enviando…" : label}
      </button>
    </div>
  );
}

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
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function intervaloLabel(de: string, ate: string): string {
  if (!ate || de === ate) return dataLabel(de);
  return `${dataCurta(de)} — ${dataCurta(ate)}`;
}

function numberToMoneyInput(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.0001) return "";
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return n < 0 ? `-${formatted}` : formatted;
}

/** 5500 → 5.500 | 5500,5 → 5.500,5 | -160 → -160  (milhar com ponto, centavos com vírgula). */
function formatPontoVirgula(raw: string): string {
  const texto = String(raw ?? "");
  const negativo = texto.trimStart().startsWith("-");
  const limpo = texto.replace(/-/g, "").replace(/[^\d,]/g, "");
  if (!limpo) return negativo ? "-" : "";

  const virgula = limpo.indexOf(",");
  const intRaw = virgula === -1 ? limpo : limpo.slice(0, virgula);
  const decRaw =
    virgula === -1 ? undefined : limpo.slice(virgula + 1).replace(/,/g, "").slice(0, 2);
  const intDigits = intRaw.replace(/^0+(?=\d)/, "");
  const intFmt = (intDigits || (decRaw !== undefined ? "0" : "")).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "."
  );
  if (!intFmt && decRaw === undefined) return negativo ? "-" : "";

  const corpo = decRaw !== undefined ? `${intFmt || "0"},${decRaw}` : intFmt;
  return negativo ? `-${corpo}` : corpo;
}

function completarMoney(raw: string): string {
  const texto = String(raw ?? "").trim();
  if (!texto || texto === "-") return "";
  return formatMoneyInputOnBlur(texto);
}

const TITULO_PADRAO = "Resumo";

type Props = {
  pontos: PontoRascunho[];
  empresaNome: string;
  operadoresVisao?: OperadorVisao[];
};

/** Digita valores → Salvar para manter. Enviar para operadores é um passo à parte. */
export function DashboardRascunhoClient({
  pontos,
  empresaNome,
  operadoresVisao = [],
}: Props) {
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO);
  const [dataFim, setDataFim] = useState(hojeISO);
  const [vista, setVista] = useState<"dia" | "periodo">("dia");
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
  const [portalPronto, setPortalPronto] = useState(false);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  const [linkCompartilhamento, setLinkCompartilhamento] = useState<string | null>(null);
  const [operadoresSel, setOperadoresSel] = useState<string[]>([]);
  const [publicando, setPublicando] = useState(false);
  const [dividas, setDividas] = useState<DividaLinha[]>(() => [novaDividaLinha()]);

  const puxarFolha = useCallback(async (deISO: string, ateISO: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deISO)) return;
    const ate =
      /^\d{4}-\d{2}-\d{2}$/.test(ateISO) && ateISO >= deISO ? ateISO : deISO;
    const periodo = ate !== deISO;
    setCarregandoDia(true);
    setFeedback(null);
    try {
      const qs = new URLSearchParams({ data: deISO });
      if (periodo) qs.set("ate", ate);
      const res = await fetch(`/api/rascunho/dia?${qs.toString()}`);
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
        setFeedback(
          body.error ??
            (periodo
              ? "Não foi possível carregar o período."
              : "Não foi possível carregar o dia.")
        );
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
      setFeedback(
        periodo
          ? "Não foi possível carregar o período."
          : "Não foi possível carregar o dia."
      );
    } finally {
      setCarregandoDia(false);
    }
  }, []);

  const deFolha = dataSelecionada;
  const ateFolha =
    vista === "periodo" && dataFim >= dataSelecionada ? dataFim : dataSelecionada;

  useEffect(() => {
    void puxarFolha(deFolha, ateFolha);
  }, [deFolha, ateFolha, puxarFolha]);

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

  const dividasPreenchidas = useMemo(
    () =>
      dividas
        .map((d) => ({
          nome: d.nome.trim() || "Dívida",
          valor: Math.abs(parseMoneyInput(d.valor)),
        }))
        .filter((d) => d.valor > 0.009),
    [dividas]
  );
  const totalDividas = round2(
    dividasPreenchidas.reduce((s, d) => s + d.valor, 0)
  );
  const totalCaixa = round2(pix + dinheiro);
  const sobra = round2(totalCaixa - totalDividas);

  function montarSnapshot(): ResumoRascunhoSnapshot {
    return {
      empresaNome,
      titulo: titulo.trim() || TITULO_PADRAO,
      dataISO: deFolha,
      ...(ateFolha !== deFolha ? { dataFimISO: ateFolha } : {}),
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
      ...(dividasPreenchidas.length
        ? {
            dividas: dividasPreenchidas,
            totalDividas,
            sobra,
          }
        : {}),
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

  async function publicarVisao() {
    setFeedback(null);
    if (operadoresSel.length === 0) {
      setFeedback("Selecione quem recebe essa visão.");
      return;
    }
    setPublicando(true);
    try {
      const res = await fetch("/api/visao/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: vista === "periodo" ? ateFolha : dataSelecionada,
          equipe_ids: operadoresSel,
          valores: pontos.map((p) => ({
            ponto_id: p.id,
            valor: parseMoneyInput(valores[p.id] ?? ""),
            forma: metaPorPonto[p.id]?.forma ?? null,
          })),
        }),
      });
      const body = (await res.json()) as { error?: string; publicados?: number };
      if (!res.ok) {
        setFeedback(body.error ?? "Não foi possível publicar.");
        return;
      }
      const nomes = operadoresVisao
        .filter((o) => operadoresSel.includes(o.id))
        .map((o) => o.nome);
      const quem =
        nomes.length === 1
          ? nomes[0]
          : nomes.length === 2
            ? `${nomes[0]} e ${nomes[1]}`
            : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
      setFeedback(
        `Enviado para ${quem} (${body.publicados ?? 0} valores). A folha continua salva aqui.`
      );
    } catch {
      setFeedback("Erro de conexão ao publicar.");
    } finally {
      setPublicando(false);
    }
  }

  function setValor(id: string, raw: string) {
    setPixEditadoManual(false);
    setDinheiroEditadoManual(false);
    const limpo = formatPontoVirgula(raw);
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

  function setDivida(id: string, field: "nome" | "valor", raw: string) {
    const valor = field === "valor" ? formatPontoVirgula(raw) : raw;
    setDividas((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: valor } : d))
    );
    setLinkCompartilhamento(null);
  }

  function adicionarDivida() {
    setDividas((prev) => [...prev, novaDividaLinha()]);
    setLinkCompartilhamento(null);
  }

  function removerDivida(id: string) {
    setDividas((prev) => prev.filter((d) => d.id !== id));
    setLinkCompartilhamento(null);
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
    setDividas([novaDividaLinha()]);
  }

  function salvar() {
    if (preenchidos === 0) {
      setFeedback("Preencha pelo menos um valor.");
      return;
    }
    setFeedback("Folha salva. Ninguém recebeu ainda — marque os operadores para enviar.");
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
        "relative -mx-4 min-h-[60vh] px-4 pb-8 sm:mx-0 sm:px-0",
        !salvo && "pb-52",
        "rascunho-folha font-[family-name:var(--font-rasc-sans)]"
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
              <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#c4a574]/90">
                OperaRoute
              </p>
              <h1
                className="text-[clamp(2.4rem,8vw,3.4rem)] font-normal leading-[0.95] tracking-tight text-[var(--shell-text)]"
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                Resumo
              </h1>
              <p className="max-w-md text-[16px] leading-relaxed text-[var(--shell-text-muted)]">
                Escolha o dia ou um período. Dívidas (D.P, Patrão, Renato…) ficam no quadro
                dourado logo abaixo — e também no botão da faixa de salvar.
              </p>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVista("dia")}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                      vista === "dia"
                        ? "bg-[#c4a574] text-[#0a0e16]"
                        : "border border-[var(--shell-border)] text-[var(--shell-text-muted)]"
                    )}
                  >
                    Dia
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVista("periodo");
                      if (dataFim < dataSelecionada) setDataFim(dataSelecionada);
                    }}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                      vista === "periodo"
                        ? "bg-[#c4a574] text-[#0a0e16]"
                        : "border border-[var(--shell-border)] text-[var(--shell-text-muted)]"
                    )}
                  >
                    Período
                  </button>
                </div>

                {vista === "dia" ? (
                  <label className="block space-y-2">
                    <span className="text-[12px] uppercase tracking-[0.18em] text-slate-500">
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
                          className="w-full min-w-[11rem] border-0 border-b border-[var(--shell-border)] bg-transparent py-2 pl-6 pr-1 text-[16px] text-[var(--shell-text)] focus:border-[#c4a574]/50 focus:outline-none"
                        />
                      </div>
                      {carregandoDia ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando…
                        </span>
                      ) : (
                        <>
                          {puxouDia ? (
                            <span className="text-[13px] text-[#c4a574]/90">
                              Coletas do dia importadas
                            </span>
                          ) : (
                            <span className="text-[13px] text-slate-600">
                              Nenhuma coleta neste dia
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void puxarFolha(deFolha, ateFolha)}
                            className="text-[13px] text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
                          >
                            Atualizar
                          </button>
                        </>
                      )}
                    </div>
                  </label>
                ) : (
                  <div className="space-y-3">
                    <span className="text-[12px] uppercase tracking-[0.18em] text-slate-500">
                      Período da rota
                    </span>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="text-[13px] text-slate-500">De</span>
                        <input
                          type="date"
                          value={dataSelecionada}
                          max={dataFim}
                          onChange={(e) => {
                            if (e.target.value) setDataSelecionada(e.target.value);
                          }}
                          className="w-full border-0 border-b border-[var(--shell-border)] bg-transparent py-2 text-[16px] text-[var(--shell-text)] focus:border-[#c4a574]/50 focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[13px] text-slate-500">Até</span>
                        <input
                          type="date"
                          value={dataFim}
                          min={dataSelecionada}
                          onChange={(e) => {
                            if (e.target.value) setDataFim(e.target.value);
                          }}
                          className="w-full border-0 border-b border-[var(--shell-border)] bg-transparent py-2 text-[16px] text-[var(--shell-text)] focus:border-[#c4a574]/50 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {carregandoDia ? (
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando…
                        </span>
                      ) : (
                        <>
                          {puxouDia ? (
                            <span className="text-[13px] text-[#c4a574]/90">
                              Coletas do período importadas
                            </span>
                          ) : (
                            <span className="text-[13px] text-slate-600">
                              Nenhuma coleta neste período
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void puxarFolha(deFolha, ateFolha)}
                            className="text-[13px] text-slate-500 underline-offset-2 transition hover:text-slate-300 hover:underline"
                          >
                            Atualizar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-white/[0.08] pt-4 text-[13px] text-slate-500">
                <span className="capitalize text-slate-400">
                  {intervaloLabel(deFolha, ateFolha)}
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
                className="w-full border-0 border-b border-white/15 bg-transparent px-0 py-2 text-[15px] text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:border-[#c4a574]/50 focus:outline-none"
              />
            </header>

            <section
              id="rascunho-dividas"
              className="space-y-5 rounded-xl border-2 border-[#c4a574] bg-[#c4a574]/10 p-4"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[12px] uppercase tracking-[0.18em] text-slate-500">
                    Pix
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={pixInputValue}
                    onChange={(e) => {
                      setPixEditadoManual(true);
                      setPixStr(formatPontoVirgula(e.target.value));
                    }}
                    onBlur={(e) => {
                      if (!pixEditadoManual) return;
                      setPixStr(completarMoney(e.target.value));
                    }}
                    className="w-full border-0 border-b border-white/15 bg-transparent py-2 text-[18px] tabular-nums text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:border-[#c4a574]/50 focus:outline-none"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-[12px] uppercase tracking-[0.18em] text-slate-500">
                    Dinheiro
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={dinheiroInputValue}
                    onChange={(e) => {
                      setDinheiroEditadoManual(true);
                      setDinheiroStr(formatPontoVirgula(e.target.value));
                    }}
                    onBlur={(e) => {
                      if (!dinheiroEditadoManual) return;
                      setDinheiroStr(completarMoney(e.target.value));
                    }}
                    className="w-full border-0 border-b border-white/15 bg-transparent py-2 text-[18px] tabular-nums text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:border-[#c4a574]/50 focus:outline-none"
                  />
                </label>
              </div>

              <div className="space-y-4 border-t border-white/[0.08] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8a6a3a]">
                    Dívidas a descontar
                  </p>
                  <button
                    type="button"
                    onClick={adicionarDivida}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#c4a574] px-3 py-1.5 text-[12px] font-semibold text-[#0a0e16]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
                <ul className="space-y-3">
                  {dividas.map((d) => (
                    <li key={d.id} className="flex items-end gap-3">
                      <label className="min-w-0 flex-1 space-y-1">
                        <span className="sr-only">Nome da dívida</span>
                        <input
                          type="text"
                          value={d.nome}
                          onChange={(e) => setDivida(d.id, "nome", e.target.value)}
                          placeholder="Ex.: D.P, Patrão, Renato…"
                          className="w-full border-0 border-b border-white/15 bg-transparent py-2 text-[15px] text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:border-[#c4a574]/50 focus:outline-none"
                        />
                      </label>
                      <label className="w-[7.75rem] shrink-0 space-y-1">
                        <span className="sr-only">Valor</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={d.valor}
                          onChange={(e) => setDivida(d.id, "valor", e.target.value)}
                          onBlur={(e) =>
                            setDivida(d.id, "valor", completarMoney(e.target.value))
                          }
                          placeholder="0,00"
                          className="w-full border-0 border-b border-white/15 bg-transparent py-2 text-right text-[16px] tabular-nums text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:border-[#c4a574]/50 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removerDivida(d.id)}
                        className="mb-2 shrink-0 p-1 text-slate-500 transition hover:text-rose-300"
                        aria-label="Remover dívida"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                <p className="text-[12px] uppercase tracking-[0.16em] text-slate-500">
                  No caixa
                </p>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-slate-500">Pix</span>
                  <span className="tabular-nums text-[var(--shell-text)]">
                    {formatCurrency(pix)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-slate-500">Dinheiro</span>
                  <span className="tabular-nums text-[var(--shell-text)]">
                    {formatCurrency(dinheiro)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.08] pt-3 text-[13px]">
                  <span className="text-slate-500">Total no caixa</span>
                  <span className="tabular-nums text-[var(--shell-text)]">
                    {formatCurrency(totalCaixa)}
                  </span>
                </div>
                {dividasPreenchidas.length > 0 ? (
                  <div className="space-y-2 border-t border-white/[0.08] pt-3">
                    <p className="text-[12px] uppercase tracking-[0.16em] text-slate-500">
                      Dívidas
                    </p>
                    {dividasPreenchidas.map((d) => (
                      <div
                        key={`${d.nome}-${d.valor}`}
                        className="flex items-baseline justify-between gap-3 text-[13px]"
                      >
                        <span className="min-w-0 truncate text-slate-400">{d.nome}</span>
                        <span className="tabular-nums text-rose-300">
                          − {formatCurrency(d.valor)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-3 pt-1 text-[13px]">
                      <span className="text-slate-500">Total dívidas</span>
                      <span className="tabular-nums text-rose-300">
                        − {formatCurrency(totalDividas)}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.08] pt-3">
                  <span className="text-[13px] uppercase tracking-[0.16em] text-slate-500">
                    Sobra
                  </span>
                  <span
                    className={cn(
                      "text-[1.35rem] tabular-nums",
                      sobra < 0 ? "text-rose-300" : "text-[#c4a574]"
                    )}
                    style={{
                      fontFamily: "var(--font-rasc-display), Georgia, serif",
                    }}
                  >
                    {formatCurrency(sobra)}
                  </span>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1.5 text-[13px] text-slate-500 transition hover:text-slate-300"
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
                          <span className="w-5 shrink-0 text-[13px] tabular-nums text-[var(--shell-text-muted)]">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div className="relative w-[7.75rem] shrink-0">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="—"
                              value={valores[p.id] ?? ""}
                              onChange={(e) => setValor(p.id, e.target.value)}
                              onBlur={(e) =>
                                setValor(p.id, completarMoney(e.target.value))
                              }
                              className={cn(
                                "w-full border-b bg-transparent py-2 pr-1 text-right text-[16px] tabular-nums placeholder:text-[var(--shell-text-muted)] focus:outline-none",
                                preenchido
                                  ? v < 0
                                    ? "border-rose-400/40 text-rose-600"
                                    : "border-[#c4a574]/40 text-[var(--shell-text)]"
                                  : "border-[var(--shell-border)] text-[var(--shell-text)] focus:border-[#c4a574]/40"
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[16px] font-medium text-[var(--shell-text)]">
                              {p.nome}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {p.status !== "ativo" ? (
                                <p className="text-[12px] capitalize text-slate-600">
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

            <section className="space-y-4 border-t border-white/[0.08] pt-8">
              <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-slate-500">Recebido</span>
                  <span className="tabular-nums text-[var(--shell-text)]">
                    {formatCurrency(resumoCaixa.recebido)}
                  </span>
                </div>
                {resumoCaixa.deixado > 0.009 ? (
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-slate-500">Deixado no ponto</span>
                    <span className="tabular-nums text-rose-300">
                      − {formatCurrency(resumoCaixa.deixado)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.08] pt-3">
                  <span className="text-[13px] uppercase tracking-[0.16em] text-slate-500">
                    Total líquido
                  </span>
                  <span
                    className="text-[1.35rem] tabular-nums text-[#c4a574]"
                    style={{
                      fontFamily: "var(--font-rasc-display), Georgia, serif",
                    }}
                  >
                    {formatCurrency(resumoCaixa.liquido)}
                  </span>
                </div>
              </div>
              {feedback ? (
                <p className="text-[13px] text-rose-400">{feedback}</p>
              ) : null}
            </section>

            {portalPronto
              ? createPortal(
                  <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] px-3 lg:px-6">
                    <div className="pointer-events-auto mx-auto mb-[calc(4rem+env(safe-area-inset-bottom,0px))] max-w-2xl rounded-2xl border border-[#c4a574]/35 bg-[#f6f1e8]/97 px-3 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md lg:mb-4">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            adicionarDivida();
                            document
                              .getElementById("rascunho-dividas")
                              ?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#c4a574] bg-white px-4 py-3 text-[14px] font-semibold tracking-wide text-[#0a0e16] transition hover:bg-[#c4a574]/15"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar dívidas
                        </button>
                        <button
                          type="button"
                          onClick={salvar}
                          className="flex w-full items-center justify-center rounded-lg bg-[#c4a574] px-4 py-3.5 text-[14px] font-semibold tracking-wide text-[#0a0e16] transition hover:brightness-110"
                        >
                          Salvar para manter
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )
              : null}
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
              <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-[#c4a574]/90">
                OperaRoute · fechamento
              </p>
              <h1
                className="text-[clamp(2.2rem,7vw,3rem)] font-normal leading-[0.95] tracking-tight text-[var(--shell-text)]"
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                {titulo.trim() || TITULO_PADRAO}
              </h1>
              <p className="capitalize text-[13px] text-slate-500">
                {intervaloLabel(deFolha, ateFolha)}
              </p>
              <div
                className="h-px w-full origin-left bg-gradient-to-r from-[#c4a574]/55 via-white/10 to-transparent"
                style={{ animation: "dashLine 0.9s 0.15s ease-out both" }}
              />
            </header>

            <section className="space-y-3">
              <div className="flex justify-between text-[13px] text-slate-500">
                <span>Recebido</span>
                <span className="tabular-nums text-slate-300">
                  {formatCurrency(resumoCaixa.recebido)}
                </span>
              </div>
              {resumoCaixa.deixado > 0.009 ? (
                <div className="flex justify-between text-[13px] text-slate-500">
                  <span>Deixado no ponto</span>
                  <span className="tabular-nums text-rose-300">
                    − {formatCurrency(resumoCaixa.deixado)}
                  </span>
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <p className="text-[12px] uppercase tracking-[0.2em] text-slate-500">
                Total líquido
              </p>
              <p
                className={cn(
                  "text-[clamp(2.8rem,10vw,4rem)] font-normal leading-none tracking-tight tabular-nums",
                  resumoCaixa.liquido < 0 ? "text-rose-300" : "text-[var(--shell-text)]"
                )}
                style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
              >
                {formatCurrency(resumoCaixa.liquido)}
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

            <section className="grid gap-6 border-y border-white/[0.08] py-6 sm:grid-cols-2">
              <div>
                <p className="text-[12px] uppercase tracking-[0.2em] text-slate-500">
                  Pix
                </p>
                <p
                  className="mt-1 text-[1.75rem] tabular-nums leading-none text-[var(--shell-text)]"
                  style={{
                    fontFamily: "var(--font-rasc-display), Georgia, serif",
                  }}
                >
                  {formatCurrency(pix)}
                </p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-[0.2em] text-slate-500">
                  Dinheiro
                </p>
                <p
                  className="mt-1 text-[1.75rem] tabular-nums leading-none text-[var(--shell-text)]"
                  style={{
                    fontFamily: "var(--font-rasc-display), Georgia, serif",
                  }}
                >
                  {formatCurrency(dinheiro)}
                </p>
              </div>
            </section>

            <section
              id="rascunho-dividas-fechamento"
              className="space-y-4 rounded-xl border-2 border-[#c4a574] bg-[#c4a574]/10 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8a6a3a]">
                  Dívidas a descontar
                </p>
                <button
                  type="button"
                  onClick={adicionarDivida}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#c4a574] px-3 py-1.5 text-[12px] font-semibold text-[#0a0e16]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>
              <ul className="space-y-3">
                {dividas.map((d) => (
                  <li key={d.id} className="flex items-end gap-3">
                    <label className="min-w-0 flex-1 space-y-1">
                      <span className="sr-only">Nome da dívida</span>
                      <input
                        type="text"
                        value={d.nome}
                        onChange={(e) => setDivida(d.id, "nome", e.target.value)}
                        placeholder="Ex.: D.P, Patrão, Renato…"
                        className="w-full border-0 border-b border-[var(--shell-border)] bg-transparent py-2 text-[15px] text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:border-[#c4a574]/50 focus:outline-none"
                      />
                    </label>
                    <label className="w-[7.75rem] shrink-0 space-y-1">
                      <span className="sr-only">Valor</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={d.valor}
                        onChange={(e) => setDivida(d.id, "valor", e.target.value)}
                        onBlur={(e) =>
                          setDivida(d.id, "valor", completarMoney(e.target.value))
                        }
                        placeholder="0,00"
                        className="w-full border-0 border-b border-[var(--shell-border)] bg-transparent py-2 text-right text-[16px] tabular-nums text-[var(--shell-text)] placeholder:text-[var(--shell-text-muted)] focus:border-[#c4a574]/50 focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removerDivida(d.id)}
                      className="mb-2 shrink-0 p-1 text-slate-500 transition hover:text-rose-300"
                      aria-label="Remover dívida"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="space-y-3 border-t border-white/[0.08] pt-4">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-slate-500">Total no caixa</span>
                  <span className="tabular-nums text-[var(--shell-text)]">
                    {formatCurrency(totalCaixa)}
                  </span>
                </div>
                {dividasPreenchidas.map((d) => (
                  <div
                    key={`${d.nome}-${d.valor}`}
                    className="flex items-baseline justify-between gap-3 text-[13px]"
                  >
                    <span className="min-w-0 truncate text-slate-400">{d.nome}</span>
                    <span className="tabular-nums text-rose-300">
                      − {formatCurrency(d.valor)}
                    </span>
                  </div>
                ))}
                {totalDividas > 0.009 ? (
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-slate-500">Total dívidas</span>
                    <span className="tabular-nums text-rose-300">
                      − {formatCurrency(totalDividas)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.08] pt-3">
                  <span className="text-[13px] uppercase tracking-[0.16em] text-slate-500">
                    Sobra
                  </span>
                  <span
                    className={cn(
                      "text-[1.75rem] tabular-nums",
                      sobra < 0 ? "text-rose-300" : "text-[var(--shell-text)]"
                    )}
                    style={{ fontFamily: "var(--font-rasc-display), Georgia, serif" }}
                  >
                    {formatCurrency(sobra)}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <h2 className="text-[12px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Por ponto
              </h2>
              <ol className="space-y-4">
                {ranking.map((r, i) => {
                  const width = Math.max(6, (Math.abs(r.valor) / maxAbs) * 100);
                  return (
                    <li key={r.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[16px] text-[var(--shell-text)]">
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
                            r.valor < 0 ? "text-rose-300" : "text-[var(--shell-text)]"
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
              <div className="w-full space-y-3">
                <p className="text-[12px] text-slate-600">
                  WhatsApp e compartilhar enviam só o link da página web.
                </p>
                {compartilhandoLink && !linkCompartilhamento ? (
                  <p className="inline-flex items-center gap-2 text-[13px] text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gerando link…
                  </p>
                ) : linkCompartilhamento ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-[#c4a574]/80" />
                      <a
                        href={linkCompartilhamento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-[13px] text-[#c4a574] underline-offset-2 hover:underline"
                      >
                        {linkCompartilhamento}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copiarLink()}
                      disabled={compartilhandoLink}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
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
                className="inline-flex items-center gap-2 text-[#c4a574] transition hover:text-[#e8d5b0] disabled:opacity-50"
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
                className="inline-flex items-center gap-2 text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
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

            <DestinosPainelOperador
              operadores={operadoresVisao}
              selecionados={operadoresSel}
              publicando={publicando}
              onToggle={(id, checked) =>
                setOperadoresSel((prev) =>
                  checked ? [...prev, id] : prev.filter((x) => x !== id)
                )
              }
              onTodos={() => setOperadoresSel(operadoresVisao.map((o) => o.id))}
              onNenhum={() => setOperadoresSel([])}
              onEnviar={() => void publicarVisao()}
            />
            {feedback ? (
              <p className="text-[13px] text-slate-400">{feedback}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
