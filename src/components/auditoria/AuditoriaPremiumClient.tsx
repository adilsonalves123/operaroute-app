"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Instrument_Serif, Outfit } from "next/font/google";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Loader2,
  Search,
  Shield,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditoriaEvento, AuditoriaSessao } from "@/lib/auditoria/types";
import {
  CATEGORIA_LABEL,
  SEVERIDADE_LABEL,
  type AuditoriaCategoria,
  type AuditoriaSeveridade,
} from "@/lib/auditoria/types";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-audit-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-audit-sans",
});

const SEV_STYLE: Record<AuditoriaSeveridade, string> = {
  critical: "border-rose-500/40 text-rose-200 bg-rose-500/10",
  high: "border-amber-500/35 text-amber-100 bg-amber-500/10",
  medium: "border-[#c4a574]/35 text-at-link bg-[#c4a574]/10",
  low: "border-at-soft text-at-primary/85 bg-at-card-soft",
  info: "border-at-soft text-at-muted bg-transparent",
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDia(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function AuditoriaPremiumClient() {
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([]);
  const [sessoes, setSessoes] = useState<AuditoriaSessao[]>([]);
  const [stats, setStats] = useState({
    total7d: 0,
    critical: 0,
    high: 0,
    sessoes: 0,
    anomalias: 0,
  });
  const [q, setQ] = useState("");
  const [severidade, setSeveridade] = useState("todos");
  const [categoria, setCategoria] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (severidade !== "todos") params.set("severidade", severidade);
      if (categoria !== "todos") params.set("categoria", categoria);

      const [evRes, sessRes] = await Promise.all([
        fetch(`/api/auditoria?${params}`),
        fetch("/api/auditoria/sessao?limit=30"),
      ]);
      const evData = await evRes.json();
      const sessData = await sessRes.json();

      if (!evRes.ok) {
        setErro(evData.error ?? "Falha ao carregar auditoria.");
        return;
      }
      setErro("");
      setEventos(evData.eventos ?? []);
      setStats(
        evData.stats ?? {
          total7d: 0,
          critical: 0,
          high: 0,
          sessoes: 0,
          anomalias: 0,
        }
      );
      if (sessRes.ok) setSessoes(sessData.sessoes ?? []);
    } catch {
      setErro("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, [q, severidade, categoria]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAtivo(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void carregar(), 200);
    return () => window.clearTimeout(id);
  }, [carregar]);

  const porDia = useMemo(() => {
    const map = new Map<string, AuditoriaEvento[]>();
    for (const e of eventos) {
      const key = e.created_at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [eventos]);

  return (
    <div
      className={cn(display.variable, sans.variable)}
      style={{ fontFamily: "var(--font-audit-sans), system-ui, sans-serif" }}
    >
      <div
        className={cn(
          "mx-auto max-w-6xl pt-6 transition duration-700 sm:pt-10",
          ativo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        )}
      >
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p
              className="text-[11px] font-medium uppercase text-at-link/90"
              style={{ letterSpacing: "0.38em" }}
            >
              Vigilância · OperaRoute
            </p>
            <h1
              className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-[0.95] tracking-tight text-at-primary"
              style={{ fontFamily: "var(--font-audit-display), Georgia, serif" }}
            >
              Auditoria
            </h1>
            <p className="mt-3 max-w-lg text-[13px] text-at-muted">
              Quem entrou, o que mudou, contadores suspeitos e divergências — trilha completa da
              operação.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-at-muted">
            <Shield className="h-3.5 w-3.5 text-at-link/80" />
            Registro imutável
          </div>
        </header>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-[#c4a574]/45 via-white/10 to-transparent" />

        <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-at bg-at-card-soft sm:grid-cols-5">
          {[
            { label: "7 dias", value: stats.total7d },
            { label: "Críticos", value: stats.critical, warn: true },
            { label: "Altos", value: stats.high, amber: true },
            { label: "Acessos", value: stats.sessoes },
            { label: "Anomalias", value: stats.anomalias, warn: true },
          ].map((c) => (
            <div key={c.label} className="bg-at-card/95 px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-at-muted">{c.label}</p>
              <p
                className={cn(
                  "mt-1.5 text-[22px] font-medium tabular-nums",
                  c.warn ? "text-rose-300" : c.amber ? "text-amber-200" : "text-at-primary"
                )}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-at-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por pessoa, ação, resumo…"
              className="w-full rounded-sm border border-at-soft bg-at-card-soft py-2.5 pl-10 pr-4 text-[13px] text-at-primary outline-none focus:border-[#c4a574]/35"
            />
          </div>
          <select
            value={severidade}
            onChange={(e) => setSeveridade(e.target.value)}
            className="rounded-sm border border-at-soft bg-at-card px-3 py-2.5 text-[13px] text-at-primary outline-none"
          >
            <option value="todos">Todas severidades</option>
            {(Object.keys(SEVERIDADE_LABEL) as AuditoriaSeveridade[]).map((s) => (
              <option key={s} value={s}>
                {SEVERIDADE_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-sm border border-at-soft bg-at-card px-3 py-2.5 text-[13px] text-at-primary outline-none"
          >
            <option value="todos">Todas categorias</option>
            {(Object.keys(CATEGORIA_LABEL) as AuditoriaCategoria[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        {erro && (
          <p className="mt-4 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {erro}
          </p>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section>
            <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-at-soft">
              Linha do tempo
            </p>

            {loading && (
              <div className="flex items-center gap-2 text-[13px] text-at-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando trilha…
              </div>
            )}

            {!loading && eventos.length === 0 && (
              <div className="rounded-sm border border-dashed border-at-soft px-6 py-16 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-at-soft" />
                <p
                  className="mt-4 text-xl text-at-primary"
                  style={{ fontFamily: "var(--font-audit-display), Georgia, serif" }}
                >
                  Ainda sem eventos
                </p>
                <p className="mx-auto mt-2 max-w-sm text-[13px] text-at-muted">
                  Assim que a equipe entrar e editar máquinas, coletas ou financeiro, tudo aparece
                  aqui com detalhe.
                </p>
              </div>
            )}

            <div className="space-y-10">
              {porDia.map(([dia, items]) => (
                <div key={dia}>
                  <p className="mb-3 text-[12px] capitalize text-at-muted">
                    {formatDia(items[0].created_at)}
                  </p>
                  <ul className="relative space-y-0 border-l border-at-soft pl-5">
                    {items.map((e) => {
                      const open = aberto === e.id;
                      const sev = (e.severidade ?? "info") as AuditoriaSeveridade;
                      return (
                        <li key={e.id} className="relative pb-5">
                          <span
                            className={cn(
                              "absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full border",
                              sev === "critical" && "border-rose-400 bg-rose-400/80",
                              sev === "high" && "border-amber-300 bg-amber-300/80",
                              sev === "medium" && "border-[#c4a574] bg-[#c4a574]/80",
                              (sev === "low" || sev === "info") && "border-slate-500 bg-slate-700"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setAberto(open ? null : e.id)}
                            className="group w-full text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
                                  SEV_STYLE[sev]
                                )}
                              >
                                {SEVERIDADE_LABEL[sev]}
                              </span>
                              <span className="text-[10px] uppercase tracking-[0.12em] text-at-soft">
                                {CATEGORIA_LABEL[(e.categoria as AuditoriaCategoria) ?? "sistema"] ??
                                  e.categoria}
                              </span>
                              <span className="ml-auto flex items-center gap-1 text-[11px] tabular-nums text-at-muted">
                                <Clock className="h-3 w-3" />
                                {formatWhen(e.created_at)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[15px] text-at-primary group-hover:text-white">
                              {e.titulo || e.acao}
                            </p>
                            {e.resumo && (
                              <p className="mt-1 text-[12px] leading-relaxed text-at-muted">
                                {e.resumo}
                              </p>
                            )}
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-at-soft">
                              <UserRound className="h-3 w-3" />
                              {e.user_nome || "Sistema"}
                              {e.user_role && (
                                <span className="uppercase tracking-wider">· {e.user_role}</span>
                              )}
                              <ChevronDown
                                className={cn(
                                  "ml-auto h-3.5 w-3.5 transition",
                                  open && "rotate-180"
                                )}
                              />
                            </p>
                          </button>

                          {open && (
                            <div className="mt-3 space-y-3 rounded-sm border border-at bg-white/[0.02] p-3 text-[12px]">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Meta label="Ação" value={e.acao} />
                                <Meta label="Tabela" value={e.tabela} />
                                <Meta label="Módulo" value={e.modulo ?? "—"} />
                                <Meta label="Registro" value={e.registro_id ?? "—"} />
                                <Meta label="E-mail" value={e.user_email ?? "—"} />
                                <Meta label="IP" value={e.ip ?? "—"} />
                              </div>
                              {(e.dados_anteriores || e.dados_novos) && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <JsonBlock title="Antes" data={e.dados_anteriores} />
                                  <JsonBlock title="Depois" data={e.dados_novos} />
                                </div>
                              )}
                              {e.meta && Object.keys(e.meta).length > 0 && (
                                <JsonBlock title="Meta" data={e.meta} />
                              )}
                              {e.user_agent && (
                                <p className="truncate text-[10px] text-at-soft">{e.user_agent}</p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <aside>
            <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-at-soft">
              Últimos acessos
            </p>
            <ul className="divide-y divide-white/[0.05] rounded-sm border border-at bg-white/[0.02]">
              {sessoes.length === 0 && (
                <li className="px-3 py-6 text-center text-[12px] text-at-muted">
                  Sem sessões registradas ainda.
                </li>
              )}
              {sessoes.map((s) => (
                <li key={s.id} className="px-3 py-3">
                  <p className="truncate text-[13px] text-at-primary">{s.user_nome ?? "Usuário"}</p>
                  <p className="mt-0.5 text-[11px] text-at-muted">
                    {s.user_role ?? "—"} · {s.dispositivo ?? "—"}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-at-soft">
                    {formatWhen(s.iniciado_em)}
                    {s.encerrado_em ? " · saiu" : " · ativo"}
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-at-soft">{label}</p>
      <p className="mt-0.5 break-all text-at-primary/85">{value}</p>
    </div>
  );
}

function JsonBlock({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null | undefined;
}) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-at-soft">{title}</p>
      <pre className="max-h-40 overflow-auto rounded-sm bg-black/30 p-2 text-[11px] leading-relaxed text-at-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
