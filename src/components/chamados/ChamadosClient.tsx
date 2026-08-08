"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Instrument_Serif, Outfit } from "next/font/google";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { NovoChamadoButton } from "@/components/chamados/NovoChamadoButton";
import { getEquipamentoDisplayNome, getEquipamentoTipoLabel } from "@/lib/equipamentos";
import {
  CHAMADO_PRIORIDADE_LABEL,
  CHAMADO_STATUS_LABEL,
  CHAMADO_STATUS_VARIANT,
  type ChamadoComEventos,
  type ChamadoEventoRow,
  type ChamadoPrioridade,
  type ChamadoStatus,
} from "@/lib/chamados/types";
import { formatDateTime, cn } from "@/lib/utils";
import {
  ChevronDown,
  MapPin,
  Play,
  CheckCircle,
  MessageSquare,
  X,
  Wrench,
  Cpu,
  Minus,
  Plus,
} from "lucide-react";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-chamados-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-chamados-sans",
});

const filtros = [
  { id: "abertos", label: "Abertos" },
  { id: "todos", label: "Todos" },
  { id: "aberta", label: "Aguardando" },
  { id: "em_andamento", label: "Em atendimento" },
  { id: "concluida", label: "Concluídos" },
] as const;

type Filtro = (typeof filtros)[number]["id"];

export type PecaEstoqueOption = {
  id: string;
  nome_item: string;
  quantidade: number;
  custo_unitario: number;
  categoria?: string;
  isPeca?: boolean;
};

type QtyMap = Record<string, number>;

function equipamentoLabel(c: ChamadoComEventos) {
  if (!c.equipamentos) return null;
  return getEquipamentoDisplayNome({
    nome: c.equipamentos.nome,
    numero_maquina: c.equipamentos.numero_maquina,
  });
}

export function ChamadosClient({
  chamados,
  pecasEstoque = [],
  loadError = false,
}: {
  chamados: ChamadoComEventos[];
  pecasEstoque?: PecaEstoqueOption[];
  loadError?: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [pecasQty, setPecasQty] = useState<Record<string, QtyMap>>({});
  const [eventosCache, setEventosCache] = useState<Record<string, ChamadoEventoRow[]>>({});
  const [carregandoEventos, setCarregandoEventos] = useState<string | null>(null);

  const abertosCount = useMemo(
    () =>
      chamados.filter((c) => c.status === "aberta" || c.status === "em_andamento").length,
    [chamados]
  );

  const lista = chamados.filter((c) => {
    if (filtro === "todos") return true;
    if (filtro === "abertos") return c.status === "aberta" || c.status === "em_andamento";
    return c.status === filtro;
  });

  async function carregarEventos(id: string, force = false) {
    if (!force && (eventosCache[id] || carregandoEventos === id)) return;
    setCarregandoEventos(id);
    try {
      const res = await fetch(`/api/chamados/${id}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.eventos)) {
        setEventosCache((prev) => ({ ...prev, [id]: data.eventos }));
      }
    } finally {
      setCarregandoEventos((atual) => (atual === id ? null : atual));
    }
  }

  function alternarExpandido(id: string) {
    const aberto = expandido === id;
    const next = aberto ? null : id;
    setExpandido(next);
    if (next) void carregarEventos(next);
  }

  function eventosDoChamado(c: ChamadoComEventos): ChamadoEventoRow[] {
    const cached = eventosCache[c.id];
    if (cached) return cached;
    return [...(c.chamado_eventos ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  function setQty(chamadoId: string, itemId: string, qty: number, max: number) {
    const next = Math.max(0, Math.min(max, Math.floor(qty)));
    setPecasQty((prev) => ({
      ...prev,
      [chamadoId]: {
        ...(prev[chamadoId] ?? {}),
        [itemId]: next,
      },
    }));
  }

  function pecasPayload(chamadoId: string) {
    const map = pecasQty[chamadoId] ?? {};
    return Object.entries(map)
      .filter(([, q]) => q > 0)
      .map(([estoque_item_id, quantidade]) => ({ estoque_item_id, quantidade }));
  }

  async function acao(
    id: string,
    action: string,
    texto?: string,
    pecas?: { estoque_item_id: string; quantidade: number }[]
  ) {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/chamados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, texto, pecas }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Erro");
        return;
      }
      setTextos((prev) => ({ ...prev, [id]: "" }));
      setPecasQty((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEventosCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      router.refresh();
      if (expandido === id) void carregarEventos(id, true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "relative -mx-4 -mt-2 min-h-[calc(100dvh-5.5rem)] overflow-hidden px-4 pb-16 text-[15px] sm:-mx-6 sm:px-6"
      )}
      style={{ fontFamily: "var(--font-chamados-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 45% at 50% -8%, rgba(196,165,116,0.12), transparent 55%), radial-gradient(ellipse 35% 30% at 90% 20%, rgba(245,158,11,0.06), transparent 50%), linear-gradient(180deg, #06080e 0%, #0a0e16 55%, #07090f 100%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p
              className="text-[12px] font-medium uppercase text-[#c4a574]/90"
              style={{ letterSpacing: "0.38em" }}
            >
              Operação · Manutenção
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-[#f4efe6]"
              style={{ fontFamily: "var(--font-chamados-display), Georgia, serif" }}
            >
              Chamados
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-400">
              Máquinas com problema — abra, acompanhe e registre a resolução.
              {abertosCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="tabular-nums text-amber-300/90">
                    {abertosCount} aberto{abertosCount === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <NovoChamadoButton />
        </header>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-[#c4a574]/50 via-white/10 to-transparent" />

        {loadError && (
          <p className="mt-6 rounded-sm border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[14px] text-rose-300">
            Não foi possível carregar chamados. Rode{" "}
            <code className="text-[13px]">supabase/chamados-manutencao.sql</code> no Supabase.
          </p>
        )}

        <div className="mt-8 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filtros.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={cn(
                "shrink-0 rounded-sm border px-3.5 py-1.5 text-[13px] transition",
                filtro === f.id
                  ? "border-[#c4a574]/40 bg-[#c4a574]/12 text-[#c4a574]"
                  : "border-white/[0.06] text-slate-500 hover:border-white/12 hover:text-slate-300"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {msg && <p className="mt-4 text-[14px] text-rose-400">{msg}</p>}

        {!lista.length ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
            <div className="flex flex-col justify-center border border-white/[0.06] bg-white/[0.02] px-6 py-14 sm:px-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-[#c4a574]/25 bg-[#c4a574]/10">
                <Wrench className="h-6 w-6 text-[#c4a574]" />
              </div>
              <h2
                className="mt-6 text-[1.75rem] tracking-tight text-[#f4efe6]"
                style={{ fontFamily: "var(--font-chamados-display), Georgia, serif" }}
              >
                Nenhum chamado
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-400">
                Quando uma máquina precisar de manutenção, abra o chamado aqui ou direto no
                equipamento do ponto.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <NovoChamadoButton />
                <Link
                  href="/pontos"
                  className="inline-flex items-center rounded-sm border border-white/[0.1] px-4 py-2.5 text-[14px] text-slate-400 transition hover:border-white/20 hover:text-[#f4efe6]"
                >
                  Ir aos pontos
                </Link>
              </div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
              {[
                {
                  t: "Abrir",
                  d: "Registre o problema com ponto, máquina e prioridade.",
                },
                {
                  t: "Atender",
                  d: "Inicie o atendimento e anote o que foi feito no local.",
                },
                {
                  t: "Concluir",
                  d: "Baixe peças do estoque e feche o chamado com a resolução.",
                },
              ].map((step) => (
                <div key={step.t} className="bg-[#0a0e16]/95 px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#c4a574]/80">
                    {step.t}
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {lista.map((c) => {
              const aberto = expandido === c.id;
              const eqLabel = equipamentoLabel(c);
              const eventos = eventosDoChamado(c);
              const loadingEventos = aberto && carregandoEventos === c.id;
              const qtyMap = pecasQty[c.id] ?? {};

              return (
                <div
                  key={c.id}
                  className={cn(
                    "overflow-hidden rounded-sm border border-white/[0.06] bg-white/[0.02] transition",
                    aberto && "border-[#c4a574]/25 bg-white/[0.03] lg:col-span-2"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => alternarExpandido(c.id)}
                    className="flex w-full items-start gap-3.5 px-4 py-4 text-left transition hover:bg-white/[0.02] sm:px-5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-amber-500/20 bg-amber-500/10">
                      <Wrench className="h-4 w-4 text-amber-300/90" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium text-[#f4efe6]">{c.titulo}</span>
                        <AlertBadge variant={CHAMADO_STATUS_VARIANT[c.status as ChamadoStatus]}>
                          {CHAMADO_STATUS_LABEL[c.status as ChamadoStatus]}
                        </AlertBadge>
                        <AlertBadge variant="warning">
                          {CHAMADO_PRIORIDADE_LABEL[c.prioridade as ChamadoPrioridade]}
                        </AlertBadge>
                      </div>
                      <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {c.pontos?.nome ?? "Ponto"}
                          {eqLabel && (
                            <>
                              {" · "}
                              {eqLabel}
                              {c.equipamentos?.tipo && (
                                <span className="text-slate-600">
                                  {" "}
                                  ({getEquipamentoTipoLabel(c.equipamentos.tipo as "cassino")})
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </p>
                      {c.descricao && (
                        <p className="line-clamp-2 text-[14px] text-slate-400">{c.descricao}</p>
                      )}
                      <p className="text-[12px] tabular-nums text-slate-600">
                        {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-slate-500 transition",
                        aberto && "rotate-180 text-[#c4a574]/80"
                      )}
                    />
                  </button>

                  {aberto && (
                    <div className="border-t border-white/[0.06] px-4 pb-5 pt-4 sm:px-5">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                            Histórico
                          </p>
                          {loadingEventos ? (
                            <p className="text-[13px] text-slate-600">Carregando histórico...</p>
                          ) : eventos.length === 0 ? (
                            <p className="text-[13px] text-slate-600">Sem eventos ainda.</p>
                          ) : (
                            <div className="space-y-2">
                              {eventos.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="rounded-sm border border-white/[0.06] bg-[#0a0e16]/80 px-3.5 py-2.5"
                                >
                                  <p className="text-[12px] text-slate-500">
                                    {formatDateTime(ev.created_at)}
                                    {ev.autor_nome && (
                                      <span className="text-slate-400"> · {ev.autor_nome}</span>
                                    )}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-[14px] text-slate-300">
                                    {ev.texto}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          {(c.status === "aberta" || c.status === "em_andamento") && (
                            <div className="space-y-3">
                              <textarea
                                value={textos[c.id] ?? ""}
                                onChange={(e) =>
                                  setTextos((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                rows={3}
                                placeholder={
                                  c.status === "aberta"
                                    ? "Ex.: Fui ao ponto, máquina com problema na fonte..."
                                    : "Descreva o que foi feito (ex.: troquei a fonte, máquina ok)..."
                                }
                                className="w-full rounded-sm border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[#f4efe6] placeholder:text-slate-600 outline-none focus:border-[#c4a574]/35"
                              />

                              {c.status === "em_andamento" && (
                                <div className="space-y-2 rounded-sm border border-amber-500/20 bg-amber-500/[0.04] p-3.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-amber-200/90">
                                      <Cpu className="h-3.5 w-3.5" />
                                      Peças usadas
                                    </p>
                                    <Link
                                      href="/estoque?categoria=pecas"
                                      className="text-[12px] text-amber-400/80 hover:underline"
                                    >
                                      Cadastrar →
                                    </Link>
                                  </div>
                                  {pecasEstoque.length === 0 ? (
                                    <p className="text-[13px] text-slate-500">
                                      Nenhuma peça de reparo cadastrada. Vá em{" "}
                                      <Link
                                        href="/estoque?categoria=pecas"
                                        className="text-amber-400 hover:underline"
                                      >
                                        Estoque → Peças
                                      </Link>
                                      .
                                    </p>
                                  ) : (
                                    <div className="max-h-56 space-y-1.5 overflow-y-auto">
                                      {pecasEstoque.map((p) => {
                                        const q = qtyMap[p.id] ?? 0;
                                        const max = Math.max(0, Number(p.quantidade) || 0);
                                        return (
                                          <div
                                            key={p.id}
                                            className="flex items-center justify-between gap-2 rounded-sm border border-white/[0.06] bg-[#0a0e16]/70 px-2.5 py-2"
                                          >
                                            <div className="min-w-0">
                                              <p className="truncate text-[14px] text-slate-200">
                                                {p.nome_item}
                                              </p>
                                              <p className="text-[12px] text-slate-500">
                                                Disp. {max}
                                                {max <= 0 ? " — sem saldo" : ""}
                                              </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                              <button
                                                type="button"
                                                disabled={q <= 0 || loading}
                                                onClick={() => setQty(c.id, p.id, q - 1, max)}
                                                className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.08] text-slate-300 hover:bg-white/[0.04] disabled:opacity-40"
                                                aria-label="Diminuir"
                                              >
                                                <Minus className="h-3.5 w-3.5" />
                                              </button>
                                              <span className="w-8 text-center text-[14px] tabular-nums text-white">
                                                {q}
                                              </span>
                                              <button
                                                type="button"
                                                disabled={q >= max || max <= 0 || loading}
                                                onClick={() => setQty(c.id, p.id, q + 1, max)}
                                                className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/[0.08] text-slate-300 hover:bg-white/[0.04] disabled:opacity-40"
                                                aria-label="Aumentar"
                                              >
                                                <Plus className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
                                {c.status === "aberta" && (
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() =>
                                      acao(c.id, "iniciar", textos[c.id]?.trim() || undefined)
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-sm bg-amber-500 px-3.5 py-2 text-[13px] font-semibold text-slate-900 disabled:opacity-50"
                                  >
                                    <Play className="h-3.5 w-3.5" />
                                    Iniciar atendimento
                                  </button>
                                )}
                                {c.status === "em_andamento" && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={loading || !textos[c.id]?.trim()}
                                      onClick={() =>
                                        acao(
                                          c.id,
                                          "concluir",
                                          textos[c.id]?.trim(),
                                          pecasPayload(c.id)
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-500 px-3.5 py-2 text-[13px] font-semibold text-slate-900 disabled:opacity-50"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Concluir chamado
                                    </button>
                                    <button
                                      type="button"
                                      disabled={loading || !textos[c.id]?.trim()}
                                      onClick={() =>
                                        acao(c.id, "comentario", textos[c.id]?.trim())
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-sm border border-white/[0.1] px-3.5 py-2 text-[13px] font-medium text-slate-300 disabled:opacity-50"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                      Só comentar
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={() => acao(c.id, "cancelar")}
                                  className="inline-flex items-center gap-1.5 rounded-sm px-3.5 py-2 text-[13px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          {c.status === "concluida" && c.observacao_resolucao && (
                            <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5">
                              <p className="mb-1 text-[12px] text-emerald-400/80">Resolução</p>
                              <p className="whitespace-pre-wrap text-[14px] text-slate-300">
                                {c.observacao_resolucao}
                              </p>
                            </div>
                          )}

                          <Link
                            href={`/pontos/${c.ponto_id}`}
                            className="inline-block text-[13px] text-[#c4a574] hover:underline"
                          >
                            Ver ponto →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LoadingOverlay show={loading} message="Salvando..." />
    </div>
  );
}
