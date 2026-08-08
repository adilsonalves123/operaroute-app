"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AlertTriangle,
  Clock3,
  Loader2,
  Hash,
  MapPin,
  Wrench,
  X,
} from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { formatContador, centesimosToReais } from "@/lib/nichos/cassino";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  getEquipamentoDisplayNome,
  getEquipamentoTipoLabel,
  cassinoSemNumeroSerie,
  isEquipamentoTipoDiversao,
} from "@/lib/equipamentos";
import type { BuscaNumeroSerieResult, ColetaSerieHistorico } from "@/lib/equipamentos/numero-serie";
import type { Equipamento } from "@/lib/types/database";
import type { ChamadoPrioridade, ChamadoStatus } from "@/lib/chamados/types";
import { EquipamentoBrindesPanel } from "@/components/equipamentos/EquipamentoBrindesPanel";
import { EquipamentoConsignadoPanel } from "@/components/equipamentos/EquipamentoConsignadoPanel";
import {
  normalizarEstoqueBrindesPonto,
  type EstoqueBrindePonto,
} from "@/lib/estoque/brindes-ponto";

type UltimaManutencao = {
  id: string;
  titulo: string;
  status: ChamadoStatus;
  prioridade: ChamadoPrioridade;
  descricao: string | null;
  observacao_resolucao: string | null;
  created_at: string;
  iniciado_em: string | null;
  concluido_em: string | null;
};

type EquipamentoDetalheResponse = {
  equipamento: Equipamento & { pontos?: { id: string; nome: string } | null };
  historicoSerie: BuscaNumeroSerieResult | null;
  ultimaLeitura: ColetaSerieHistorico | null;
  ultimaManutencao: UltimaManutencao | null;
};

const statusVariant: Record<ChamadoStatus, "danger" | "warning" | "success" | "default"> = {
  aberta: "danger",
  em_andamento: "warning",
  concluida: "success",
  cancelada: "default",
};

export function EquipamentoDetalheModal({
  open,
  onClose,
  equipamento,
  pontoNome,
  estoqueBrindesPonto = [],
  estoqueCentral = [],
}: {
  open: boolean;
  onClose: () => void;
  equipamento: Equipamento;
  pontoNome?: string | null;
  estoqueBrindesPonto?: EstoqueBrindePonto[];
  estoqueCentral?: { id: string; nome_item: string; custo_unitario: number; quantidade: number; foto_url?: string | null }[];
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dados, setDados] = useState<EquipamentoDetalheResponse | null>(null);
  const [aba, setAba] = useState<"resumo" | "leituras" | "manutencao" | "brindes" | "produtos">(
    "resumo"
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const isUrso =
      equipamento.tipo === "ursinho" ||
      equipamento.tipo === "vending_ursinho" ||
      equipamento.tipo === "bolinha";
    if (equipamento.tipo === "consignado") {
      setAba("produtos");
      return;
    }
    setAba(isUrso ? "brindes" : "resumo");
  }, [open, equipamento.id, equipamento.tipo]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/equipamentos/${equipamento.id}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Erro ao carregar equipamento.");
          return;
        }
        if (!cancelled) setDados(json as EquipamentoDetalheResponse);
      } catch {
        if (!cancelled) setError("Erro de conexão ao carregar equipamento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, equipamento.id]);

  if (!open || !mounted) return null;

  const eq = dados?.equipamento ?? equipamento;
  const ultimaLeitura = dados?.ultimaLeitura ?? null;
  const ultimaManutencao = dados?.ultimaManutencao ?? null;
  const historicoLeituras = dados?.historicoSerie?.coletas ?? [];
  const pontoLabel = dados?.equipamento.pontos?.nome ?? pontoNome ?? null;
  const foto = dados?.historicoSerie?.foto_referencia ?? eq.foto_url;
  const seriePendente = cassinoSemNumeroSerie(eq);
  const mostraBrindes =
    eq.tipo === "ursinho" || eq.tipo === "vending_ursinho" || eq.tipo === "bolinha";
  const mostraProdutos = eq.tipo === "consignado";
  const estoqueMaquina = normalizarEstoqueBrindesPonto(eq.estoque_brindes);
  const abas = [
    { id: "resumo" as const, label: "Resumo" },
    ...(mostraBrindes
      ? [
          {
            id: "brindes" as const,
            label: eq.tipo === "bolinha" ? "Cápsulas" : "Brindes",
          },
        ]
      : []),
    ...(mostraProdutos ? [{ id: "produtos" as const, label: "Produtos" }] : []),
    { id: "leituras" as const, label: "Leituras" },
    { id: "manutencao" as const, label: "Manutenção" },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(94dvh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-slate-950 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">Detalhes da máquina</p>
            <h3 className="truncate text-lg font-semibold text-white">
              {getEquipamentoDisplayNome(eq)}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <AlertBadge variant="info">{getEquipamentoTipoLabel(eq.tipo)}</AlertBadge>
              {seriePendente && (
                <AlertBadge variant="danger" className="gap-1">
                  <Hash className="h-3 w-3" />
                  Série pendente
                </AlertBadge>
              )}
              {pontoLabel && (
                <span className="inline-flex items-center gap-1 text-xs text-cyan-400">
                  <MapPin className="h-3 w-3" />
                  {pontoLabel}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && !dados ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando histórico...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {abas.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAba(item.id)}
                    className={
                      aba === item.id
                        ? "rounded-lg border border-primary-neon/40 bg-primary-neon/10 px-3 py-1.5 text-xs font-medium text-primary-neon"
                        : "rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-white"
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    {foto ? (
                      <ExpandableImage
                        src={foto}
                        alt={`Foto ${eq.nome}`}
                        className="h-56"
                      />
                    ) : (
                      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-500">
                        Sem foto do equipamento
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                    <p className="text-sm font-medium text-white">Dados atuais</p>
                    {eq.numero_serie && (
                      <div className="text-xs text-slate-400">
                        Série: <span className="font-mono text-cyan-300">{eq.numero_serie}</span>
                      </div>
                    )}
                    {seriePendente && (
                      <p className="text-xs text-rose-300/90">
                        Esta máquina ainda não tem número de série cadastrado.
                      </p>
                    )}
                    {eq.tipo === "cassino" && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-500">Entrada</p>
                          <p className="font-semibold text-green-400">
                            {eq.numero_entrada != null
                              ? formatContador(Math.round(Number(eq.numero_entrada)))
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Saída</p>
                          <p className="font-semibold text-red-400">
                            {eq.numero_saida != null
                              ? formatContador(Math.round(Number(eq.numero_saida)))
                              : "—"}
                          </p>
                        </div>
                      </div>
                    )}
                    {(eq.tipo === "ursinho" ||
                      eq.tipo === "vending_ursinho" ||
                      isEquipamentoTipoDiversao(eq.tipo)) && (
                      <div>
                        <p className="text-xs text-slate-500">Entrada atual</p>
                        <p className="font-semibold text-emerald-300">
                          {eq.entrada_atual != null
                            ? formatContador(Math.round(Number(eq.entrada_atual)))
                            : "—"}
                        </p>
                      </div>
                    )}
                    {eq.tipo === "bolinha" && (
                      <div>
                        <p className="text-xs text-slate-500">Valor da jogada</p>
                        <p className="font-semibold text-emerald-300">
                          {eq.preco_jogada != null && Number(eq.preco_jogada) > 0
                            ? formatCurrency(Number(eq.preco_jogada))
                            : "—"}
                        </p>
                        {!(eq.preco_jogada != null && Number(eq.preco_jogada) > 0) && (
                          <p className="mt-1 text-xs text-amber-300/90">
                            Use Editar para cadastrar o valor da jogada.
                          </p>
                        )}
                      </div>
                    )}
                    {eq.tipo === "fura_fura" && (
                      <p className="text-xs text-amber-300/80">
                        Fura-fura não guarda leitura individual por máquina.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {aba === "resumo" && (
                    <>
                      <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-cyan-300" />
                          <h4 className="font-medium text-white">Última leitura</h4>
                        </div>

                        {ultimaLeitura ? (
                          <>
                            <p className="text-xs text-slate-400">
                              {ultimaLeitura.created_at
                                ? formatDateTime(ultimaLeitura.created_at)
                                : "Sem data"}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                                <p className="text-xs text-slate-500">Entrada atual</p>
                                <p className="font-semibold text-green-400">
                                  {ultimaLeitura.entrada_atual != null
                                    ? formatContador(Math.round(Number(ultimaLeitura.entrada_atual)))
                                    : "—"}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                                <p className="text-xs text-slate-500">Saída atual</p>
                                <p className="font-semibold text-red-400">
                                  {ultimaLeitura.saida_atual != null
                                    ? formatContador(Math.round(Number(ultimaLeitura.saida_atual)))
                                    : "—"}
                                </p>
                              </div>
                            </div>
                            {ultimaLeitura.lucro_centavos != null && (
                              <p className="text-sm text-slate-300">
                                Lucro da leitura:{" "}
                                <span className="font-semibold text-white">
                                  {formatCurrency(centesimosToReais(ultimaLeitura.lucro_centavos))}
                                </span>
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-slate-400">
                            Nenhuma leitura individual encontrada para este equipamento.
                          </p>
                        )}
                      </section>

                      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-amber-300" />
                          <h4 className="font-medium text-white">Última manutenção</h4>
                        </div>

                        {ultimaManutencao ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <AlertBadge variant={statusVariant[ultimaManutencao.status]}>
                                {ultimaManutencao.status}
                              </AlertBadge>
                              <span className="text-xs text-slate-400">
                                {formatDateTime(ultimaManutencao.created_at)}
                              </span>
                            </div>
                            <p className="font-medium text-white">{ultimaManutencao.titulo}</p>
                            {ultimaManutencao.descricao && (
                              <p className="text-sm text-slate-300">{ultimaManutencao.descricao}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-slate-400">
                            Nenhum chamado registrado para este equipamento.
                          </p>
                        )}
                      </section>
                    </>
                  )}

                  {aba === "brindes" && mostraBrindes && (
                    <EquipamentoBrindesPanel
                      equipamentoId={eq.id}
                      estoqueBrindesMaquina={estoqueMaquina}
                      estoqueBrindesPonto={estoqueBrindesPonto}
                      estoqueCentral={estoqueCentral}
                      estoquePorMaquina={eq.tipo === "bolinha"}
                      titulo={
                        eq.tipo === "bolinha" ? "Cápsulas nesta máquina" : "Brindes na máquina"
                      }
                      onEstoqueMaquinaChange={(brindes) => {
                        setDados((prev) =>
                          prev
                            ? {
                                ...prev,
                                equipamento: { ...prev.equipamento, estoque_brindes: brindes },
                              }
                            : prev
                        );
                      }}
                    />
                  )}

                  {aba === "produtos" && mostraProdutos && (
                    <EquipamentoConsignadoPanel
                      equipamentoId={eq.id}
                      estoqueAtual={estoqueMaquina}
                      onEstoqueChange={(estoque) => {
                        setDados((prev) =>
                          prev
                            ? {
                                ...prev,
                                equipamento: { ...prev.equipamento, estoque_brindes: estoque },
                              }
                            : prev
                        );
                      }}
                    />
                  )}

                  {aba === "leituras" && (
                    <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-cyan-300" />
                        <h4 className="font-medium text-white">Histórico de leituras</h4>
                      </div>

                      {ultimaLeitura ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                              <p className="text-xs text-slate-500">Entrada atual</p>
                              <p className="font-semibold text-green-400">
                                {ultimaLeitura.entrada_atual != null
                                  ? formatContador(Math.round(Number(ultimaLeitura.entrada_atual)))
                                  : "—"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                              <p className="text-xs text-slate-500">Saída atual</p>
                              <p className="font-semibold text-red-400">
                                {ultimaLeitura.saida_atual != null
                                  ? formatContador(Math.round(Number(ultimaLeitura.saida_atual)))
                                  : "—"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                              <p className="text-xs text-slate-500">Entrada período</p>
                              <p className="font-semibold text-slate-200">
                                {ultimaLeitura.entrada_periodo != null
                                  ? formatContador(Math.round(Number(ultimaLeitura.entrada_periodo)))
                                  : "—"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-950/50 px-3 py-2">
                              <p className="text-xs text-slate-500">Saída período</p>
                              <p className="font-semibold text-slate-200">
                                {ultimaLeitura.saida_periodo != null
                                  ? formatContador(Math.round(Number(ultimaLeitura.saida_periodo)))
                                  : "—"}
                              </p>
                            </div>
                          </div>
                          {ultimaLeitura.visita_id && (
                            <Link
                              href={`/coletas/visita/${ultimaLeitura.visita_id}`}
                              className="inline-flex text-sm text-primary-neon hover:underline"
                            >
                              Abrir visita da leitura
                            </Link>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Nenhuma leitura individual encontrada para este equipamento.
                        </p>
                      )}

                      {historicoLeituras.length > 1 && (
                        <div className="space-y-2 border-t border-cyan-500/10 pt-3">
                          {historicoLeituras.slice(0, 6).map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="text-slate-400">
                                  {formatDateTime(item.created_at)}
                                </span>
                                {item.ponto_nome && (
                                  <span className="text-slate-500">{item.ponto_nome}</span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                <span className="text-green-400">
                                  Ent:{" "}
                                  {item.entrada_atual != null
                                    ? formatContador(Math.round(Number(item.entrada_atual)))
                                    : "—"}
                                </span>
                                <span className="text-red-400">
                                  Saí:{" "}
                                  {item.saida_atual != null
                                    ? formatContador(Math.round(Number(item.saida_atual)))
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {aba === "manutencao" && (
                    <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-amber-300" />
                        <h4 className="font-medium text-white">Histórico de manutenção</h4>
                      </div>

                      {ultimaManutencao ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <AlertBadge variant={statusVariant[ultimaManutencao.status]}>
                              {ultimaManutencao.status}
                            </AlertBadge>
                            <span className="text-xs text-slate-400">
                              {formatDateTime(ultimaManutencao.created_at)}
                            </span>
                          </div>
                          <p className="font-medium text-white">{ultimaManutencao.titulo}</p>
                          {ultimaManutencao.descricao && (
                            <p className="text-sm text-slate-300">{ultimaManutencao.descricao}</p>
                          )}
                          {ultimaManutencao.observacao_resolucao && (
                            <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                              <p className="text-xs text-slate-500">Resolução</p>
                              <p className="text-sm text-slate-300">
                                {ultimaManutencao.observacao_resolucao}
                              </p>
                            </div>
                          )}
                          <Link
                            href="/chamados"
                            className="inline-flex text-sm text-amber-300 hover:underline"
                          >
                            Ver manutenção completa
                          </Link>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Nenhum chamado registrado para este equipamento.
                        </p>
                      )}
                    </section>
                  )}

                  {dados?.historicoSerie?.aviso && (
                    <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{dados.historicoSerie.aviso}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
