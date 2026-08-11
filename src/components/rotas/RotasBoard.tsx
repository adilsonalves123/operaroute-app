"use client";

import { useMemo, useState } from "react";
import {
  Loader2,
  MapPin,
  Plus,
  Send,
  Trash2,
  User,
  Play,
  Filter,
} from "lucide-react";
import type { OperadorRotaOpcao, RotaSalva } from "@/lib/rotas/rotas-salvas";
import { progressoRota, statusRotaLabel } from "@/lib/rotas/rotas-salvas";
import { cn, formatDate } from "@/lib/utils";

type FiltroStatus = "todas" | "pendente" | "em_andamento" | "concluida";

type Props = {
  rotas: RotaSalva[];
  operadores: OperadorRotaOpcao[];
  onNovaRota: () => void;
  onAbrir: (rota: RotaSalva) => void;
  onEnviar: (rota: RotaSalva) => void;
  onExcluir: (id: string) => Promise<void>;
};

export function RotasBoard({
  rotas,
  operadores,
  onNovaRota,
  onAbrir,
  onEnviar,
  onExcluir,
}: Props) {
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroOperador, setFiltroOperador] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    return rotas.filter((r) => {
      if (filtroStatus !== "todas" && r.status !== filtroStatus) return false;
      if (filtroOperador && r.operador_id !== filtroOperador) return false;
      return true;
    });
  }, [rotas, filtroStatus, filtroOperador]);

  const contagens = useMemo(() => {
    return {
      todas: rotas.length,
      pendente: rotas.filter((r) => r.status === "pendente").length,
      em_andamento: rotas.filter((r) => r.status === "em_andamento").length,
      concluida: rotas.filter((r) => r.status === "concluida").length,
    };
  }, [rotas]);

  async function excluir(id: string) {
    if (!confirm("Excluir esta rota?")) return;
    setExcluindoId(id);
    try {
      await onExcluir(id);
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] px-5 py-8 sm:px-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 80% at 10% 20%, rgba(0,212,255,0.14), transparent 50%), radial-gradient(ellipse 70% 60% at 90% 80%, rgba(34,197,94,0.08), transparent 45%), linear-gradient(160deg, #0a1220 0%, #0c1528 55%, #0a0e1a 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30h60M30 0v60' stroke='%2300d4ff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/90">
              Campo · OperaRoute
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Rotas
            </h1>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Monte por cidade, atribua ao ajudante e acompanhe o que falta no campo.
            </p>
          </div>
          <button
            type="button"
            onClick={onNovaRota}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-neon px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_0_40px_-8px_rgba(0,212,255,0.55)] hover:bg-cyan-300"
          >
            <Plus className="h-4 w-4" />
            Nova rota do dia
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "todas" as const, label: "Todas", n: contagens.todas },
              { id: "pendente" as const, label: "Pendentes", n: contagens.pendente },
              { id: "em_andamento" as const, label: "Em campo", n: contagens.em_andamento },
              { id: "concluida" as const, label: "Concluídas", n: contagens.concluida },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroStatus(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium border transition",
                filtroStatus === f.id
                  ? "border-primary-neon/50 bg-primary-neon/10 text-primary-neon"
                  : "border-slate-700/80 text-slate-400 hover:border-slate-600"
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-70">{f.n}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <select
            value={filtroOperador}
            onChange={(e) => setFiltroOperador(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="">Todos os responsáveis</option>
            {operadores.map((o) => (
              <option key={o.userId} value={o.userId}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/20 px-6 py-14 text-center">
          <MapPin className="mx-auto h-10 w-10 text-slate-600 mb-3" />
          <p className="text-base font-medium text-slate-300">
            {rotas.length === 0 ? "Nenhuma rota ainda" : "Nada neste filtro"}
          </p>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {rotas.length === 0
              ? "Crie a primeira rota do dia: escolha os pontos, organize a ordem e envie para o ajudante."
              : "Tente outro status ou responsável."}
          </p>
          {rotas.length === 0 && (
            <button
              type="button"
              onClick={onNovaRota}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-neon px-5 py-2.5 text-sm font-semibold text-slate-900"
            >
              <Plus className="h-4 w-4" />
              Criar primeira rota
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtradas.map((rota) => {
            const prog = progressoRota(rota);
            return (
              <li
                key={rota.id}
                className="group rounded-xl border border-white/[0.07] bg-slate-900/35 px-4 py-4 sm:px-5 transition hover:border-cyan-500/25 hover:bg-slate-900/55"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white tracking-tight truncate">
                        {rota.nome}
                      </h3>
                      {rota.status !== "concluida" && prog.pendentes > 0 && (
                        <span className="rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
                          Faltam {prog.pendentes}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          rota.status === "concluida"
                            ? "bg-green-500/15 text-green-400"
                            : rota.status === "em_andamento"
                              ? "bg-cyan-500/15 text-cyan-300"
                              : "bg-slate-500/15 text-slate-400"
                        )}
                      >
                        {statusRotaLabel(rota.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      {rota.cidade && (
                        <span className="inline-flex items-center gap-1 text-cyan-400/80">
                          <MapPin className="h-3 w-3" />
                          {rota.cidade}
                        </span>
                      )}
                      <span>
                        {prog.concluidas}/{prog.total} paradas
                      </span>
                      <span>{formatDate(rota.created_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {rota.operador_nome ?? "Sem responsável"}
                      </span>
                    </div>
                    <div className="h-1.5 max-w-xs rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          rota.status === "concluida" ? "bg-green-500" : "bg-primary-neon"
                        )}
                        style={{ width: `${prog.percentual}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAbrir(rota)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-neon/90 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-cyan-300"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {rota.status === "em_andamento"
                        ? "Continuar"
                        : rota.status === "concluida"
                          ? "Ver"
                          : "Abrir"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEnviar(rota)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Atribuir
                    </button>
                    <button
                      type="button"
                      disabled={excluindoId === rota.id}
                      onClick={() => void excluir(rota.id)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      title="Excluir"
                    >
                      {excluindoId === rota.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
