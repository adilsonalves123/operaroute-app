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

const chipBase =
  "shrink-0 rounded-sm border px-3 py-1.5 text-[12px] transition inline-flex items-center gap-1.5";
const chipOn = "border-[#c4a574]/40 bg-[#c4a574]/12 text-[#c4a574]";
const chipOff = "border-white/[0.06] text-slate-500 hover:border-white/12 hover:text-slate-300";

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
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 sm:-mx-6 sm:px-6"
      )}
      style={{ fontFamily: "var(--font-eq-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 45% at 50% -8%, rgba(196,165,116,0.12), transparent 55%), radial-gradient(ellipse 40% 30% at 0% 60%, rgba(120,90,50,0.08), transparent 50%), linear-gradient(180deg, #06080e 0%, #0a0e16 55%, #07090f 100%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p
              className="text-[11px] font-medium uppercase text-[#c4a574]/90"
              style={{ letterSpacing: "0.38em" }}
            >
              Inventário · OperaRoute
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-[#f4efe6]"
              style={{ fontFamily: "var(--font-eq-display), Georgia, serif" }}
            >
              Equipamentos
            </h1>
            <p className="mt-3 max-w-md text-[13px] text-slate-400">
              Máquinas da operação — por tipo, ponto e status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/estoque?categoria=pecas"
              className="inline-flex items-center gap-2 rounded-sm border border-white/[0.1] px-4 py-2.5 text-[13px] text-slate-400 transition hover:border-white/20 hover:text-[#f4efe6]"
            >
              <Package className="h-3.5 w-3.5 opacity-70" />
              Peças
            </Link>
            <Link
              href="/equipamentos/buscar"
              className="inline-flex items-center gap-2 rounded-sm border border-white/[0.1] px-4 py-2.5 text-[13px] text-slate-400 transition hover:border-white/20 hover:text-[#f4efe6]"
            >
              <Search className="h-3.5 w-3.5 opacity-70" />
              Buscar série
            </Link>
            <CadastrarEquipamentoEstoqueForm nichosAtivos={nichosAtivos} />
          </div>
        </header>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-[#c4a574]/50 via-white/10 to-transparent" />

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total },
            { label: "No estoque", value: stats.emEstoque },
            { label: "Ativos", value: stats.ativos },
            { label: "Manutenção", value: stats.emManutencao, warn: stats.emManutencao > 0 },
          ].map((cell) => (
            <div key={cell.label} className="bg-[#0a0e16]/95 px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{cell.label}</p>
              <p
                className={cn(
                  "mt-1.5 text-[20px] font-medium tabular-nums",
                  cell.warn ? "text-amber-300/90" : "text-[#f4efe6]"
                )}
              >
                {cell.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por série, número, nome ou ponto…"
              className="w-full rounded-sm border border-white/[0.08] bg-white/[0.03] py-2.5 pl-10 pr-4 text-[13px] text-[#f4efe6] placeholder:text-slate-600 outline-none transition focus:border-[#c4a574]/35"
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
                className={cn(chipBase, filtroLocal === s ? chipOn : chipOff)}
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
                className={cn(chipBase, filtroStatus === s ? chipOn : chipOff)}
              >
                {s === "todos" ? "Todos status" : s === "ativo" ? "Ativos" : "Inativos"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSomenteManutencao((v) => !v)}
              className={cn(
                chipBase,
                somenteManutencao
                  ? "border-[#c4a574]/40 bg-[#c4a574]/10 text-[#e8d5b0]"
                  : chipOff
              )}
            >
              <Wrench className="h-3 w-3" />
              Manutenção
            </button>
            <button
              type="button"
              onClick={() => setSomenteSeriePendente((v) => !v)}
              className={cn(
                chipBase,
                somenteSeriePendente
                  ? "border-white/20 bg-white/[0.06] text-[#f4efe6]"
                  : chipOff
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
              className="flex-1 rounded-sm border border-white/[0.08] bg-[#0a0e16] px-3 py-2.5 text-[13px] text-[#f4efe6] outline-none focus:border-[#c4a574]/35"
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
              className="flex-1 rounded-sm border border-white/[0.08] bg-[#0a0e16] px-3 py-2.5 text-[13px] text-[#f4efe6] outline-none focus:border-[#c4a574]/35"
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
            <div className="mb-4 flex h-14 w-14 items-center justify-center border border-white/[0.08] text-slate-500">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <h3
              className="text-xl text-[#f4efe6]"
              style={{ fontFamily: "var(--font-eq-display), Georgia, serif" }}
            >
              Nenhum equipamento
            </h3>
            <p className="mt-2 max-w-sm text-[13px] text-slate-500">
              Cadastre no estoque com número de série. Depois aloque no ponto.
            </p>
          </div>
        ) : filtrados.length === 0 ? (
          <p className="mt-12 text-center text-[13px] text-slate-500">
            Nenhum equipamento neste filtro.
          </p>
        ) : (
          <div className="mt-8">
            <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-slate-600">
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
