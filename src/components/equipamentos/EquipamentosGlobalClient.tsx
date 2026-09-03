"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Instrument_Serif, Outfit } from "next/font/google";
import { Gamepad2, Hash, Package, Search, Wrench } from "lucide-react";
import { EquipamentosList } from "@/components/pontos/EquipamentosList";
import { CadastrarEquipamentoEstoqueForm } from "@/components/equipamentos/CadastrarEquipamentoEstoqueForm";
import {
  EQUIPAMENTO_GRUPOS,
  cassinoSemNumeroSerie,
  equipamentoCombinaBusca,
  type EquipamentoGrupoId,
  type EquipamentoTipo,
} from "@/lib/equipamentos";
import type { ChamadoResumoEquipamento } from "@/lib/chamados/types";
import type { Equipamento, Nicho } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-eq-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-eq-sans",
});

type EquipamentoComPonto = Equipamento & {
  pontos?: { id: string; nome: string; status?: string } | null;
};

type Props = {
  equipamentos: EquipamentoComPonto[];
  pontos: { id: string; nome: string }[];
  chamadosAbertos: ChamadoResumoEquipamento[];
  nichosAtivos?: Nicho[];
};

type FiltroStatus = "todos" | "ativo" | "inativo";
type FiltroTipo = "todos" | EquipamentoGrupoId;
type FiltroLocal = "todos" | "estoque" | "alocados";

export function EquipamentosGlobalClient({
  equipamentos,
  pontos,
  chamadosAbertos,
  nichosAtivos,
}: Props) {
  const [busca, setBusca] = useState("");
  const [filtroPonto, setFiltroPonto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativo");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroLocal, setFiltroLocal] = useState<FiltroLocal>("todos");
  const [somenteManutencao, setSomenteManutencao] = useState(false);
  const [somenteSeriePendente, setSomenteSeriePendente] = useState(false);

  const equipamentosComChamado = useMemo(
    () => new Set(chamadosAbertos.map((c) => c.equipamento_id).filter(Boolean)),
    [chamadosAbertos]
  );

  const pontosPorId = useMemo(() => {
    const map = new Map(pontos.map((p) => [p.id, p]));
    for (const eq of equipamentos) {
      if (eq.pontos?.id && !map.has(eq.pontos.id)) {
        map.set(eq.pontos.id, { id: eq.pontos.id, nome: eq.pontos.nome });
      }
    }
    return map;
  }, [pontos, equipamentos]);

  const filtrados = useMemo(() => {
    return equipamentos.filter((eq) => {
      if (filtroStatus !== "todos" && eq.status !== filtroStatus) return false;
      if (filtroLocal === "estoque" && eq.ponto_id) return false;
      if (filtroLocal === "alocados" && !eq.ponto_id) return false;
      if (filtroPonto && eq.ponto_id !== filtroPonto) return false;
      if (!equipamentoCombinaBusca(eq, busca)) return false;
      if (somenteManutencao && !equipamentosComChamado.has(eq.id)) return false;
      if (somenteSeriePendente && !cassinoSemNumeroSerie(eq)) return false;

      if (filtroTipo !== "todos") {
        const grupo = EQUIPAMENTO_GRUPOS.find((g) => g.id === filtroTipo);
        if (grupo && !grupo.tipos.includes(eq.tipo as EquipamentoTipo)) return false;
      }

      return true;
    });
  }, [
    equipamentos,
    filtroStatus,
    filtroLocal,
    filtroPonto,
    busca,
    somenteManutencao,
    somenteSeriePendente,
    equipamentosComChamado,
    filtroTipo,
  ]);

  const stats = useMemo(() => {
    const ativos = equipamentos.filter((e) => e.status === "ativo").length;
    const emEstoque = equipamentos.filter((e) => !e.ponto_id).length;
    const emManutencao = equipamentos.filter((e) => equipamentosComChamado.has(e.id)).length;
    const seriePendente = equipamentos.filter((e) => cassinoSemNumeroSerie(e)).length;
    const porGrupo = EQUIPAMENTO_GRUPOS.map((g) => ({
      ...g,
      count: equipamentos.filter((e) => g.tipos.includes(e.tipo as EquipamentoTipo)).length,
    })).filter((g) => g.count > 0);

    return { total: equipamentos.length, ativos, emEstoque, emManutencao, seriePendente, porGrupo };
  }, [equipamentos, equipamentosComChamado]);

  return (
    <div
      className={cn(display.variable, sans.variable)}
      style={{ fontFamily: "var(--font-eq-sans), system-ui, sans-serif" }}
    >
      <div className="relative mx-auto max-w-6xl pt-6 sm:pt-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-at-link">
              Inventário · OperaRoute
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-at-primary"
              style={{ fontFamily: "var(--font-eq-display), Georgia, serif" }}
            >
              Equipamentos
            </h1>
            <p className="mt-3 max-w-md text-[13px] text-at-muted">
              Máquinas da operação — por tipo, ponto e status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/estoque?categoria=pecas"
              className="analise-tab-idle inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] transition"
            >
              <Package className="h-3.5 w-3.5 opacity-70" />
              Peças
            </Link>
            <Link
              href="/equipamentos/buscar"
              className="analise-tab-idle inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] transition"
            >
              <Search className="h-3.5 w-3.5 opacity-70" />
              Buscar série
            </Link>
            <CadastrarEquipamentoEstoqueForm nichosAtivos={nichosAtivos} />
          </div>
        </header>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-[var(--at-link)]/50 via-[var(--at-divider)] to-transparent" />

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-grid sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total },
            { label: "No estoque", value: stats.emEstoque },
            { label: "Ativos", value: stats.ativos },
            { label: "Manutenção", value: stats.emManutencao, warn: stats.emManutencao > 0 },
          ].map((cell) => (
            <div key={cell.label} className="bg-at-card px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">{cell.label}</p>
              <p
                className={cn(
                  "mt-1.5 text-[20px] font-medium tabular-nums text-at-primary",
                  cell.warn && "text-amber-600 dark:text-amber-300/90"
                )}
              >
                {cell.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-at bg-at-card px-3.5 py-2.5 transition focus-within:border-[var(--at-tab-active-border)]">
            <Search className="h-4 w-4 shrink-0 text-at-muted" aria-hidden />
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por série, número, nome ou ponto…"
              className="equipamentos-search min-w-0 flex-1 border-0 !bg-transparent !p-0 text-[13px] text-at-primary shadow-none outline-none placeholder:text-at-soft focus:ring-0"
              aria-label="Buscar equipamentos"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["todos", "estoque", "alocados"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setFiltroLocal(s);
                  if (s === "estoque") setFiltroPonto("");
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                  filtroLocal === s ? "analise-tab-active" : "analise-tab-idle"
                )}
              >
                {s === "estoque" && <Package className="h-3 w-3" />}
                {s === "todos" ? "Todos" : s === "estoque" ? "No estoque" : "Nos pontos"}
              </button>
            ))}
            {(["todos", "ativo", "inativo"] as const).map((s) => (
              <button
                key={`st-${s}`}
                type="button"
                onClick={() => setFiltroStatus(s)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                  filtroStatus === s ? "analise-tab-active" : "analise-tab-idle"
                )}
              >
                {s === "todos" ? "Todos status" : s === "ativo" ? "Ativos" : "Inativos"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSomenteManutencao((v) => !v)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                somenteManutencao ? "analise-tab-active" : "analise-tab-idle"
              )}
            >
              <Wrench className="h-3 w-3" />
              Manutenção
            </button>
            <button
              type="button"
              onClick={() => setSomenteSeriePendente((v) => !v)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                somenteSeriePendente ? "analise-tab-active" : "analise-tab-idle"
              )}
            >
              <Hash className="h-3 w-3" />
              Série pendente
              {stats.seriePendente > 0 && (
                <span className="tabular-nums text-[10px] opacity-80">{stats.seriePendente}</span>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={filtroPonto}
              onChange={(e) => {
                setFiltroPonto(e.target.value);
                if (e.target.value) setFiltroLocal("alocados");
              }}
              className="flex-1 rounded-lg border border-at bg-at-card px-3 py-2.5 text-[13px] text-at-primary outline-none focus:border-[var(--at-tab-active-border)]"
            >
              <option value="">Todos os pontos</option>
              {pontos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
              className="flex-1 rounded-lg border border-at bg-at-card px-3 py-2.5 text-[13px] text-at-primary outline-none focus:border-[var(--at-tab-active-border)]"
            >
              <option value="todos">Todos os tipos</option>
              {EQUIPAMENTO_GRUPOS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {equipamentos.length === 0 ? (
          <div className="mt-16 flex flex-col items-center px-4 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-at text-at-muted">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <h3
              className="text-xl text-at-primary"
              style={{ fontFamily: "var(--font-eq-display), Georgia, serif" }}
            >
              Nenhum equipamento
            </h3>
            <p className="mt-2 max-w-sm text-[13px] text-at-muted">
              Cadastre no estoque com número de série. Depois aloque no ponto.
            </p>
          </div>
        ) : filtrados.length === 0 ? (
          <p className="mt-12 text-center text-[13px] text-at-muted">
            Nenhum equipamento neste filtro.
          </p>
        ) : (
          <div className="mt-8">
            <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-at-soft">
              {filtrados.length} resultado{filtrados.length === 1 ? "" : "s"}
            </p>
            <EquipamentosList
              equipamentos={filtrados}
              showPonto
              pontosPorId={pontosPorId}
              todosPontos={pontos}
              chamadosAbertos={chamadosAbertos}
              hideSearch
              emptyMessage="Nenhum equipamento encontrado."
            />
          </div>
        )}
      </div>
    </div>
  );
}
