"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Play,
  Route,
} from "lucide-react";
import type { RotaSalva } from "@/lib/rotas/rotas-salvas";
import {
  progressoRota,
  proximaParadaRota,
  rotasDoOperador,
  statusRotaLabel,
} from "@/lib/rotas/rotas-salvas";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  rotas: RotaSalva[];
  userId: string;
  pontosPorId: Map<string, { nome: string; cidade?: string | null; endereco?: string | null }>;
  onIniciar: (rota: RotaSalva) => void;
  onContinuar: (rota: RotaSalva) => void;
  rotaAtivaId?: string | null;
  /** Quando true, mostra hero completo (tela só do operador) */
  hero?: boolean;
};

export function MinhaRotaPainel({
  rotas,
  userId,
  pontosPorId,
  onIniciar,
  onContinuar,
  rotaAtivaId,
  hero = true,
}: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const minhasRotas = useMemo(() => rotasDoOperador(rotas, userId), [rotas, userId]);

  const rotaEmAndamento = minhasRotas.find((r) => r.status === "em_andamento");
  const rotasPendentes = minhasRotas.filter(
    (r) => r.status === "pendente" && r.id !== rotaEmAndamento?.id
  );
  const concluidas = minhasRotas.filter((r) => r.status === "concluida").slice(0, 3);

  async function iniciarRota(rota: RotaSalva) {
    setLoadingId(rota.id);
    setMsg("");
    try {
      const res = await fetch(`/api/rotas/${rota.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "iniciar" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((data as { error?: string }).error ?? "Não foi possível iniciar a rota.");
        return;
      }
      onIniciar({ ...rota, status: "em_andamento" });
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (minhasRotas.length === 0) {
    if (!hero) return null;
    return (
      <div className="space-y-4">
        <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] px-5 py-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 80% 10%, rgba(0,212,255,0.12), transparent 50%), linear-gradient(165deg, #0a1220, #0a0e1a)",
            }}
          />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-400/80">Campo</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Minha rota</h1>
            <p className="mt-2 text-sm text-slate-400">
              Quando o gestor enviar uma rota, ela aparece aqui para você executar.
            </p>
          </div>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-700/80 px-6 py-12 text-center">
          <Route className="mx-auto h-9 w-9 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-300">Nenhuma rota atribuída</p>
          <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
            Peça ao gerente para montar a rota e clicar em Enviar — chega no app e pode vir no
            WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hero && (
        <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] px-5 py-7">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 15% 0%, rgba(0,212,255,0.16), transparent 50%), linear-gradient(165deg, #0a1220, #0a0e1a)",
            }}
          />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-400/80">Hoje em campo</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Minha rota</h1>
            {rotaEmAndamento ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="rounded-xl bg-amber-600 px-3 py-2 text-white">
                  <span className="text-[10px] uppercase tracking-wide text-white/80">Faltam</span>
                  <p className="text-xl font-bold tabular-nums leading-none">
                    {progressoRota(rotaEmAndamento).pendentes}
                  </p>
                </div>
                <p className="text-sm text-slate-400 max-w-sm">
                  Continue de onde parou. Ao coletar um ponto, ele entra como feito
                  automaticamente.
                </p>
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-slate-400">
                {rotasPendentes.length} rota(s) aguardando início.
              </p>
            )}
          </div>
        </header>
      )}

      {msg && (
        <p className="text-sm text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          {msg}
        </p>
      )}

      {rotaEmAndamento && (
        <RotaOperadorCard
          rota={rotaEmAndamento}
          pontosPorId={pontosPorId}
          destaque
          loading={loadingId === rotaEmAndamento.id}
          ativa={rotaAtivaId === rotaEmAndamento.id}
          onAcao={() => onContinuar(rotaEmAndamento)}
          labelAcao="Continuar"
        />
      )}

      {rotasPendentes.length > 0 && (
        <section className="space-y-3">
          {!rotaEmAndamento && (
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Aguardando início
            </h2>
          )}
          {rotaEmAndamento && (
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Próximas na fila
            </h2>
          )}
          {rotasPendentes.map((rota) => (
            <RotaOperadorCard
              key={rota.id}
              rota={rota}
              pontosPorId={pontosPorId}
              loading={loadingId === rota.id}
              ativa={rotaAtivaId === rota.id}
              onAcao={() => void iniciarRota(rota)}
              labelAcao="Iniciar"
            />
          ))}
        </section>
      )}

      {concluidas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Concluídas
          </h2>
          {concluidas.map((rota) => (
            <RotaOperadorCard
              key={rota.id}
              rota={rota}
              pontosPorId={pontosPorId}
              concluida
              onAcao={() => onContinuar(rota)}
              labelAcao="Ver rota"
            />
          ))}
        </section>
      )}
    </div>
  );
}

function RotaOperadorCard({
  rota,
  pontosPorId,
  destaque,
  concluida,
  loading,
  ativa,
  onAcao,
  labelAcao,
}: {
  rota: RotaSalva;
  pontosPorId: Map<string, { nome: string; cidade?: string | null; endereco?: string | null }>;
  destaque?: boolean;
  concluida?: boolean;
  loading?: boolean;
  ativa?: boolean;
  onAcao: () => void;
  labelAcao: string;
}) {
  const prog = progressoRota(rota);
  const proxima = proximaParadaRota(rota);
  const proximoPonto = proxima ? pontosPorId.get(proxima.ponto_id) : null;

  return (
    <article
      className={cn(
        "rounded-2xl border p-5 space-y-4",
        destaque
          ? "border-primary-neon/40 bg-gradient-to-br from-cyan-500/10 via-slate-900/80 to-slate-950"
          : "border-white/[0.07] bg-slate-900/40",
        ativa && "ring-1 ring-primary-neon/50"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight text-white">{rota.nome}</p>
          <p className="text-xs text-slate-500 mt-0.5">{formatDate(rota.created_at)}</p>
          {rota.cidade && (
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {rota.cidade}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!concluida && prog.pendentes > 0 && (
            <span className="rounded-lg bg-amber-600 px-2.5 py-1 text-center text-white">
              <span className="block text-[9px] uppercase tracking-wide text-white/80">Faltam</span>
              <span className="text-lg font-bold tabular-nums leading-none">{prog.pendentes}</span>
            </span>
          )}
          <span
            className={cn(
              "rounded-md px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              rota.status === "concluida"
                ? "bg-green-500/20 text-green-400"
                : rota.status === "em_andamento"
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-slate-500/20 text-slate-400"
            )}
          >
            {statusRotaLabel(rota.status)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>
            {prog.concluidas} de {prog.total} paradas
          </span>
          <span className="tabular-nums">{prog.percentual}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              concluida ? "bg-green-500" : "bg-primary-neon"
            )}
            style={{ width: `${prog.percentual}%` }}
          />
        </div>
      </div>

      {proximoPonto && !concluida && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3",
            destaque
              ? "border-primary-neon/25 bg-slate-950/50"
              : "border-white/10 bg-slate-900/50"
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Próxima parada</p>
          <p className="text-base font-semibold text-white mt-1">{proximoPonto.nome}</p>
          {(proximoPonto.endereco || proximoPonto.cidade) && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {[proximoPonto.endereco, proximoPonto.cidade].filter(Boolean).join(" — ")}
            </p>
          )}
        </div>
      )}

      {concluida && (
        <p className="text-xs text-green-400/90 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Rota concluída
        </p>
      )}

      {!concluida && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onAcao}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-50",
              destaque
                ? "bg-primary-neon text-slate-900 hover:bg-cyan-300"
                : "bg-slate-800 text-white hover:bg-slate-700"
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {labelAcao}
          </button>
        </div>
      )}
    </article>
  );
}
