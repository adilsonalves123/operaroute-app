"use client";

import { useMemo, useState } from "react";
import {
  Eraser,
  MessageCircle,
  Pencil,
  Share2,
} from "lucide-react";
import { whatsAppUrlRota } from "@/lib/rotas/whatsapp-rota";
import { cn, formatCurrency, parseMoneyInput } from "@/lib/utils";

export type PontoRascunho = {
  id: string;
  nome: string;
  status: string;
};

type Props = {
  pontos: PontoRascunho[];
};

function montarTextoResumo(opts: {
  titulo: string;
  total: number;
  preenchidos: number;
  ranking: { nome: string; valor: number }[];
}): string {
  const linhas = [
    `*${opts.titulo || "Dashboard"} — OperaRoute*`,
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
    <div className={cn("mx-auto max-w-3xl space-y-8", !salvo && "pb-28")}>
      <header className="space-y-2">
        {salvo ? (
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {titulo.trim() || "Dashboard"}
          </h1>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Dashboard
            </h1>
            <p className="text-[13px] leading-relaxed text-slate-500">
              Digite o valor na frente de cada ponto. Use{" "}
              <span className="text-slate-400">-</span> para negativo. Depois
              toque em <span className="text-slate-300">Salvar</span>.
            </p>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (opcional)"
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-slate-600"
            />
          </>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              total < 0 ? "text-rose-300" : "text-emerald-300"
            )}
          >
            {formatCurrency(total)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Pontos
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {preenchidos}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Média</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-300">
            {formatCurrency(media)}
          </p>
        </div>
      </section>

      {!salvo ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Todos os pontos
              </h2>
              <button
                type="button"
                onClick={limpar}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-slate-400 transition hover:border-white/20 hover:text-slate-200"
              >
                <Eraser className="h-3.5 w-3.5" />
                Limpar
              </button>
            </div>

            {!lista.length ? (
              <p className="text-[13px] text-slate-500">Nenhum ponto cadastrado.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06]">
                {lista.map((p) => {
                  const v = parseMoneyInput(valores[p.id] ?? "");
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 bg-white/[0.02] px-3 py-2.5"
                    >
                      <div className="relative w-[8.5rem] shrink-0">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-slate-500">
                          R$
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={valores[p.id] ?? ""}
                          onChange={(e) => setValor(p.id, e.target.value)}
                          className={cn(
                            "w-full rounded-lg border border-white/10 bg-slate-950/60 py-2 pl-8 pr-2 text-right text-[13px] tabular-nums placeholder:text-slate-600",
                            v < 0 ? "text-rose-300" : "text-white"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-slate-200">{p.nome}</p>
                        {p.status !== "ativo" ? (
                          <p className="text-[11px] capitalize text-slate-600">
                            {p.status}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {feedback ? <p className="text-[12px] text-rose-400">{feedback}</p> : null}
          </section>

          {/* Sempre visível — lista longa não esconde o Salvar */}
          <div className="fixed inset-x-0 bottom-16 z-30 border-t border-white/10 bg-[#0a0e16]/95 px-4 py-3 backdrop-blur-md lg:bottom-0">
            <div className="mx-auto flex max-w-3xl gap-2">
              <button
                type="button"
                onClick={salvar}
                className="flex flex-1 items-center justify-center rounded-xl bg-[#c4a574] px-4 py-3.5 text-[15px] font-semibold text-slate-950 transition hover:bg-[#d4b584]"
              >
                Salvar
              </button>
            </div>
          </div>
        </>
      ) : (
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Resumo
              </h2>
            </div>
            <ol className="divide-y divide-white/[0.06]">
              {ranking.map((r, i) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]"
                >
                  <span className="min-w-0 truncate text-slate-300">
                    <span
                      className={cn(
                        "mr-2 inline-block w-5 tabular-nums",
                        i === 0 ? "text-amber-300" : "text-slate-600"
                      )}
                    >
                      {i + 1}.
                    </span>
                    {r.nome}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      r.valor < 0 ? "text-rose-300" : "text-white"
                    )}
                  >
                    {formatCurrency(r.valor)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enviarWhatsApp}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-[13px] font-medium text-emerald-200 transition hover:bg-emerald-500/15"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void compartilhar()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.08]"
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
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.08]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
            <button
              type="button"
              onClick={limpar}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-[13px] text-slate-400 transition hover:border-white/20 hover:text-slate-200"
            >
              <Eraser className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>
          {feedback ? <p className="text-[12px] text-slate-400">{feedback}</p> : null}
        </section>
      )}
    </div>
  );
}
