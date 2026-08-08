"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Clock, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UNIVERSIDADE_AULAS,
  UNIVERSIDADE_MODULOS,
  labelModuloUniversidade,
  type UniversidadeAula,
  type UniversidadeModulo,
} from "@/lib/universidade/aulas";

export function UniversidadeClient() {
  const [aulas, setAulas] = useState<UniversidadeAula[]>(UNIVERSIDADE_AULAS);
  const [filtro, setFiltro] = useState<UniversidadeModulo | "todos">("todos");
  const [ativa, setAtiva] = useState<UniversidadeAula | null>(
    () => UNIVERSIDADE_AULAS.find((a) => a.youtubeId) ?? UNIVERSIDADE_AULAS[0] ?? null
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/universidade/aulas")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d?.aulas) ? (d.aulas as UniversidadeAula[]) : [];
        if (list.length === 0) return;
        setAulas(list);
        setAtiva((prev) => {
          const still = prev && list.find((a) => a.id === prev.id);
          if (still) return still;
          return list.find((a) => a.youtubeId) ?? list[0] ?? null;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filtradas = useMemo(() => {
    if (filtro === "todos") return aulas;
    return aulas.filter((a) => a.modulo === filtro);
  }, [aulas, filtro]);

  const comVideo = aulas.filter((a) => a.youtubeId).length;

  return (
    <div
      className="uni-route-bg relative overflow-hidden rounded-2xl px-1 py-2 sm:px-2"
      style={{ fontFamily: "var(--font-uni-sans), system-ui, sans-serif" }}
    >
      <header className="relative z-[1] max-w-2xl pt-4 sm:pt-6">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#c9a87c]"
          style={{ fontFamily: "var(--font-uni-sans), system-ui, sans-serif" }}
        >
          Central de ajuda
        </p>
        <h1
          className="mt-3 text-[clamp(1.85rem,4.5vw,2.75rem)] font-medium leading-[0.95] tracking-[-0.04em] text-[#f4f7fb]"
          style={{ fontFamily: "var(--font-uni-display), system-ui, sans-serif" }}
        >
          Como usar o OperaRoute
        </h1>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-slate-400">
          Vídeos curtos por módulo — do primeiro acesso à coleta e ao financeiro.
          {comVideo === 0
            ? " Em breve os vídeos entram aqui; a lista já mostra o que vamos gravar."
            : null}
        </p>
      </header>

      <div className="relative z-[1] mt-8 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {UNIVERSIDADE_MODULOS.map((m) => {
          const selected = filtro === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setFiltro(m.id)}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-medium transition",
                selected
                  ? "bg-[#c9a87c]/15 text-[#c9a87c] ring-1 ring-[#c9a87c]/35"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="relative z-[1] mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40">
            {ativa?.youtubeId ? (
              <div className="aspect-video w-full">
                <iframe
                  title={ativa.titulo}
                  src={`https://www.youtube.com/embed/${ativa.youtubeId}?rel=0`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-900/80 to-slate-950 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  <Film className="h-6 w-6 text-[#c9a87c]/80" />
                </div>
                <p
                  className="text-lg font-medium tracking-tight text-[#f4f7fb]"
                  style={{
                    fontFamily: "var(--font-uni-display), system-ui, sans-serif",
                  }}
                >
                  {ativa?.titulo ?? "Selecione uma aula"}
                </p>
                <p className="max-w-sm text-[13px] text-slate-500">
                  Vídeo ainda não publicado. Quando estiver pronto, aparece aqui
                  automaticamente.
                </p>
              </div>
            )}
          </div>

          {ativa && (
            <div className="uni-fade-in border-t border-white/[0.06] pt-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#c9a87c]/90">
                {labelModuloUniversidade(ativa.modulo)} · {ativa.duracao}
              </p>
              <h2
                className="mt-2 text-xl font-medium tracking-tight text-[#f4f7fb]"
                style={{
                  fontFamily: "var(--font-uni-display), system-ui, sans-serif",
                }}
              >
                {ativa.titulo}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-slate-400">
                {ativa.descricao}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="px-1 text-[12px] text-slate-500">
            {filtradas.length} aula{filtradas.length === 1 ? "" : "s"}
            {filtro !== "todos"
              ? ` em ${UNIVERSIDADE_MODULOS.find((m) => m.id === filtro)?.label}`
              : ""}
          </p>
          <ul className="space-y-1.5">
            {filtradas.map((aula, i) => {
              const selected = ativa?.id === aula.id;
              const pronta = Boolean(aula.youtubeId);
              return (
                <li key={aula.id}>
                  <button
                    type="button"
                    onClick={() => setAtiva(aula)}
                    className={cn(
                      "uni-fade-in flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition",
                      selected
                        ? "bg-white/[0.05] ring-1 ring-[#c9a87c]/30"
                        : "hover:bg-white/[0.03]"
                    )}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        selected
                          ? "border-[#c9a87c]/40 bg-[#c9a87c]/10 text-[#c9a87c]"
                          : "border-white/10 text-slate-500"
                      )}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "text-[14px] font-medium leading-snug",
                            selected ? "text-[#f4f7fb]" : "text-slate-200"
                          )}
                        >
                          {aula.titulo}
                        </span>
                        {!pronta && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-600">
                            Em breve
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{labelModuloUniversidade(aula.modulo)}</span>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {aula.duracao}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
