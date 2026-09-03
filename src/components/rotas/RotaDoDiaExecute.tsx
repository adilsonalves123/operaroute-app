"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Navigation,
  Package,
  SkipForward,
} from "lucide-react";
import type { ParadaRota } from "@/lib/rotas/otimizar-rota";
import type { RotaSalva } from "@/lib/rotas/rotas-salvas";
import { progressoRota } from "@/lib/rotas/rotas-salvas";
import { linksNavegacaoPonto } from "@/lib/nichos/fura-fura";
import type { PontoRotaEnriquecido } from "@/components/rotas/RotaInteligenteClient";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  rota: RotaSalva;
  paradas: ParadaRota[];
  pontos: PontoRotaEnriquecido[];
  onVoltar: () => void;
  onMarcarParada: (pontoId: string, pulada: boolean) => Promise<void> | void;
  onVerMapa?: () => void;
};

/**
 * Execução de campo: próximo ponto → Coletar → Faltam N.
 * Sem mapa/reordenar como tela principal.
 */
export function RotaDoDiaExecute({
  rota,
  paradas,
  pontos,
  onVoltar,
  onMarcarParada,
  onVerMapa,
}: Props) {
  const pendentes = useMemo(
    () =>
      paradas
        .filter((p) => !p.statusParada || p.statusParada === "pendente")
        .slice()
        .sort((a, b) => a.ordem - b.ordem),
    [paradas]
  );

  const [focoId, setFocoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const proximo =
    (focoId ? pendentes.find((p) => p.id === focoId) : null) ?? pendentes[0] ?? null;

  const pontoOriginal = proximo
    ? pontos.find((p) => p.id === proximo.id)
    : undefined;
  const nav = pontoOriginal ? linksNavegacaoPonto(pontoOriginal) : null;
  const prog = progressoRota({
    ...rota,
    paradas: rota.paradas,
    total_paradas: rota.total_paradas || paradas.length,
  });

  const feitos = Math.max(0, prog.total - pendentes.length);
  const percentual =
    prog.total > 0 ? Math.round((feitos / prog.total) * 100) : 100;

  async function marcar(pulada: boolean) {
    if (!proximo || busy) return;
    setBusy(true);
    try {
      await onMarcarParada(proximo.id, pulada);
      setFocoId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center gap-1.5 text-sm text-at-muted hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-at-muted">
            Rota do dia
            {rota.cidade ? ` · ${rota.cidade}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{rota.nome}</h1>
        </div>
        {pendentes.length > 0 ? (
          <div className="rounded-xl bg-amber-600 px-3.5 py-2 text-center text-white shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/85">Faltam</p>
            <p className="text-2xl font-bold tabular-nums leading-none">{pendentes.length}</p>
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white">
            Concluída
          </div>
        )}
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percentual}%` }}
        />
      </div>

      {!proximo ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-3 text-lg font-semibold text-white">Rota concluída</p>
          <p className="mt-1 text-sm text-at-muted">Todos os pontos desta rota foram atendidos.</p>
        </div>
      ) : (
        <article className="overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-slate-900/90 to-slate-950">
          {(proximo.fotoUrl || pontoOriginal?.fotoExibir || pontoOriginal?.foto_url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                proximo.fotoUrl ||
                pontoOriginal?.fotoExibir ||
                pontoOriginal?.foto_url ||
                ""
              }
              alt=""
              className="h-36 w-full object-cover"
            />
          )}
          <div className="space-y-4 p-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">Próximo</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                {proximo.nome}
              </h2>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-at-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {[proximo.endereco, proximo.cidade].filter(Boolean).join(" · ") ||
                    "Sem endereço — ok para checklist"}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(proximo.pendente ?? pontoOriginal?.pendente ?? 0) > 0.009 && (
                <span className="rounded-md bg-amber-600/90 px-2 py-1 text-[11px] font-medium text-white">
                  Deve {formatCurrency(proximo.pendente ?? pontoOriginal?.pendente ?? 0)}
                </span>
              )}
              {(pontoOriginal?.chamadosAbertos?.length ?? 0) > 0 && (
                <span className="rounded-md bg-orange-600/90 px-2 py-1 text-[11px] font-medium text-white">
                  {pontoOriginal!.chamadosAbertos!.length} manutenção
                  {pontoOriginal!.chamadosAbertos!.length === 1 ? "" : "ões"}
                </span>
              )}
            </div>

            <Link
              href={`/coletas/nova?ponto=${proximo.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c4a574] py-3.5 text-sm font-semibold text-slate-950 hover:bg-[#d4b584]"
            >
              <Package className="h-4 w-4" />
              Coletar
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void marcar(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar feito
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void marcar(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-at-soft py-2.5 text-sm font-medium text-at-primary/85 hover:bg-white/5 disabled:opacity-50"
              >
                <SkipForward className="h-4 w-4" />
                Pular
              </button>
            </div>

            {nav && (
              <div className="flex gap-2">
                <a
                  href={nav.waze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs text-at-muted hover:border-slate-500"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Waze
                </a>
                <a
                  href={nav.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs text-at-muted hover:border-slate-500"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Maps
                </a>
              </div>
            )}
          </div>
        </article>
      )}

      {pendentes.length > 1 && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-at-muted">
            Ainda faltam ({pendentes.length})
          </h3>
          <ul className="space-y-1.5">
            {pendentes.map((p, i) => {
              const ativo = proximo?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setFocoId(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                      ativo
                        ? "border-[#c4a574]/40 bg-[#c4a574]/10"
                        : "border-at bg-slate-900/40 hover:border-white/12"
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold tabular-nums text-at-primary/85">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{p.nome}</span>
                      <span className="block truncate text-[11px] text-at-muted">
                        {[p.endereco, p.cidade].filter(Boolean).join(" · ") || "Sem endereço"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {onVerMapa && pendentes.length > 0 && (
        <button
          type="button"
          onClick={onVerMapa}
          className="w-full rounded-xl border border-at-soft py-2.5 text-sm text-at-muted hover:bg-at-card-soft hover:text-at-primary/90"
        >
          Ver mapa / navegação GPS
        </button>
      )}
    </div>
  );
}
