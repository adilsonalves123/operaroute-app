"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Box,
  Circle,
  Gift,
  MapPin,
  Package,
  Search,
  Store,
} from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { resumirKitNoPonto } from "@/lib/estoque/alocados-pontos";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";
import { somarEstoqueBrindes } from "@/lib/estoque/transferir-maquina";
import { cn, formatCurrency } from "@/lib/utils";

export type PontoFuraAlocado = {
  id: string;
  nome: string;
  cidade: string | null;
  bairro: string | null;
  kit_ativo_id: string | null;
  kit_nome: string | null;
  kit_instalado_em: string | null;
  furos_estoque: number | null;
  furos_minimo: number | null;
  estoque_brindes: unknown;
  reposicao: { nome: string; quantidade: number; estoque_item_id?: string | null }[];
};

export type MaquinaAlocada = {
  id: string;
  nome: string;
  tipo: string;
  ponto_id: string;
  ponto_nome: string;
  numero_maquina: string | null;
  estoque_brindes: unknown;
};

type NichoTab = "fura_fura" | "ursinho" | "bolinha" | "consignado";

type Props = {
  furaPontos: PontoFuraAlocado[];
  ursinho: MaquinaAlocada[];
  bolinha: MaquinaAlocada[];
  consignado: MaquinaAlocada[];
};

const TABS: { id: NichoTab; label: string; icon: ReactNode }[] = [
  { id: "fura_fura", label: "Fura Fura", icon: <Package className="h-3.5 w-3.5" /> },
  { id: "ursinho", label: "Ursinho", icon: <Box className="h-3.5 w-3.5" /> },
  { id: "bolinha", label: "Bolinha", icon: <Circle className="h-3.5 w-3.5" /> },
  { id: "consignado", label: "Consignado", icon: <Store className="h-3.5 w-3.5" /> },
];

function localLabel(cidade: string | null, bairro: string | null) {
  return [bairro, cidade].filter(Boolean).join(" · ") || null;
}

export function EstoqueAlocadosClient({
  furaPontos,
  ursinho,
  bolinha,
  consignado,
}: Props) {
  const [tab, setTab] = useState<NichoTab>("fura_fura");
  const [busca, setBusca] = useState("");
  const [soTroca, setSoTroca] = useState(false);

  const furaRows = useMemo(() => {
    return furaPontos
      .map((p) => {
        const resumo = resumirKitNoPonto(p.estoque_brindes, p.reposicao);
        return { ...p, resumo };
      })
      .filter((p) => {
        if (soTroca && !p.resumo.potencialTroca) return false;
        const q = busca.trim().toLowerCase();
        if (!q) return true;
        return (
          p.nome.toLowerCase().includes(q) ||
          (p.kit_nome ?? "").toLowerCase().includes(q) ||
          (p.cidade ?? "").toLowerCase().includes(q) ||
          (p.bairro ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.resumo.potencialTroca !== b.resumo.potencialTroca) {
          return a.resumo.potencialTroca ? -1 : 1;
        }
        return a.resumo.pctRestante - b.resumo.pctRestante;
      });
  }, [furaPontos, busca, soTroca]);

  const maquinas = useMemo(() => {
    const list =
      tab === "ursinho" ? ursinho : tab === "bolinha" ? bolinha : consignado;
    const q = busca.trim().toLowerCase();
    return list
      .map((m) => {
        const itens = normalizarEstoqueBrindesPonto(m.estoque_brindes);
        return { ...m, itens, total: somarEstoqueBrindes(itens) };
      })
      .filter((m) => {
        if (!q) return true;
        return (
          m.nome.toLowerCase().includes(q) ||
          m.ponto_nome.toLowerCase().includes(q) ||
          m.itens.some((i) => i.nome.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.total - b.total || a.ponto_nome.localeCompare(b.ponto_nome));
  }, [tab, ursinho, bolinha, consignado, busca]);

  const furaStats = useMemo(() => {
    let potencial = 0;
    for (const p of furaPontos) {
      if (resumirKitNoPonto(p.estoque_brindes, p.reposicao).potencialTroca) potencial += 1;
    }
    return {
      comKit: furaPontos.filter((p) => p.kit_ativo_id).length,
      potencial,
      total: furaPontos.length,
    };
  }, [furaPontos]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSoTroca(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              tab === t.id
                ? "border border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                : "border border-slate-700 text-slate-400 hover:text-white"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fura_fura" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Pontos com kit ativo</p>
            <p className="text-2xl font-bold text-white tabular-nums">{furaStats.comKit}</p>
          </div>
          <div className="glass-card border-amber-500/20 p-4">
            <p className="text-xs text-slate-500">Potencial de troca (≤40%)</p>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">
              {furaStats.potencial}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500">Pontos ativos listados</p>
            <p className="text-2xl font-bold text-slate-200 tabular-nums">
              {furaStats.total}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              tab === "fura_fura"
                ? "Buscar ponto, kit, cidade..."
                : "Buscar ponto, máquina ou item..."
            }
            className="min-w-0 flex-1 !border-0 !bg-transparent !p-0 text-sm text-white placeholder:text-slate-400 focus:!shadow-none"
          />
        </div>
        {tab === "fura_fura" && (
          <button
            type="button"
            onClick={() => setSoTroca((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium",
              soTroca
                ? "border border-amber-500/40 bg-amber-500/15 text-amber-200"
                : "border border-slate-700 text-slate-400 hover:text-white"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Só potencial troca
          </button>
        )}
      </div>

      {tab === "fura_fura" ? (
        furaRows.length === 0 ? (
          <EmptyState
            title="Nenhum ponto fura-fura encontrado"
            description="Instale kits nos pontos ou limpe os filtros."
            icon={<Package className="h-8 w-8" />}
          />
        ) : (
          <div className="space-y-3">
            {furaRows.map((p) => {
              const local = localLabel(p.cidade, p.bairro);
              const furosBaixo =
                p.furos_minimo != null &&
                p.furos_estoque != null &&
                Number(p.furos_minimo) > 0 &&
                Number(p.furos_estoque) <= Number(p.furos_minimo);

              return (
                <div
                  key={p.id}
                  className={cn(
                    "glass-card space-y-3 p-4",
                    p.resumo.potencialTroca && "border-amber-500/30 ring-1 ring-amber-500/15"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/pontos/${p.id}`}
                          className="font-semibold text-white hover:text-cyan-300 hover:underline"
                        >
                          {p.nome}
                        </Link>
                        {p.resumo.potencialTroca && (
                          <AlertBadge variant="warning" className="text-[10px]">
                            Potencial troca
                          </AlertBadge>
                        )}
                        {furosBaixo && (
                          <AlertBadge variant="danger" className="text-[10px]">
                            Furos baixos
                          </AlertBadge>
                        )}
                      </div>
                      {local && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {local}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Kit restante</p>
                      <p
                        className={cn(
                          "text-xl font-bold tabular-nums",
                          p.resumo.pctRestante <= 40
                            ? "text-amber-400"
                            : p.resumo.pctRestante <= 70
                              ? "text-cyan-300"
                              : "text-emerald-400"
                        )}
                      >
                        {p.kit_ativo_id ? `${p.resumo.pctRestante}%` : "—"}
                      </p>
                    </div>
                  </div>

                  {!p.kit_ativo_id ? (
                    <p className="text-sm text-slate-500">Sem kit ativo neste ponto.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>
                          Kit:{" "}
                          <span className="font-medium text-slate-200">
                            {p.kit_nome ?? "—"}
                          </span>
                        </span>
                        <span>
                          Unidades:{" "}
                          <span className="tabular-nums text-slate-200">
                            {p.resumo.totalAtual}/{p.resumo.totalOriginal}
                          </span>
                        </span>
                        {p.furos_estoque != null && (
                          <span>
                            Furos:{" "}
                            <span
                              className={cn(
                                "tabular-nums",
                                furosBaixo ? "text-rose-300" : "text-slate-200"
                              )}
                            >
                              {p.furos_estoque}
                              {p.furos_minimo != null ? ` (mín. ${p.furos_minimo})` : ""}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            p.resumo.pctRestante <= 40
                              ? "bg-amber-500"
                              : p.resumo.pctRestante <= 70
                                ? "bg-cyan-500"
                                : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(100, p.resumo.pctRestante)}%` }}
                        />
                      </div>

                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {p.resumo.itens
                          .filter((i) => i.original > 0 || i.atual > 0)
                          .map((i) => (
                            <div
                              key={`${p.id}-${i.nome}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-xs"
                            >
                              <span className="truncate text-slate-300">{i.nome}</span>
                              <span
                                className={cn(
                                  "shrink-0 tabular-nums",
                                  i.original > 0 && i.atual / i.original <= 0.3
                                    ? "text-amber-300"
                                    : "text-slate-400"
                                )}
                              >
                                {i.atual}
                                {i.original > 0 ? `/${i.original}` : ""}
                              </span>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : maquinas.length === 0 ? (
        <EmptyState
          title="Nenhuma máquina com estoque"
          description="Aloque itens nas máquinas/expositores dos pontos."
          icon={<Gift className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-3">
          {maquinas.map((m) => (
            <div key={m.id} className="glass-card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/pontos/${m.ponto_id}`}
                    className="font-semibold text-white hover:text-cyan-300 hover:underline"
                  >
                    {m.ponto_nome}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {m.numero_maquina ? `Nº ${m.numero_maquina} · ` : ""}
                    {m.nome}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">No equipamento</p>
                  <p className="text-xl font-bold tabular-nums text-cyan-300">
                    {m.total} <span className="text-sm font-normal text-slate-500">un.</span>
                  </p>
                </div>
              </div>
              {m.itens.length === 0 ? (
                <p className="text-xs text-slate-500">Sem itens alocados.</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {m.itens.map((i) => (
                    <div
                      key={`${m.id}-${i.item_id ?? i.nome}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate text-slate-300">{i.nome}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">
                        {i.quantidade}
                        {i.custo_unitario != null && Number(i.custo_unitario) > 0
                          ? ` · ${formatCurrency(Number(i.custo_unitario))}`
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
