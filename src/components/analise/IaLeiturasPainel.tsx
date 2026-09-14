"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IaPrecisaoResumo } from "@/lib/nichos/cassino/ia-precisao";
import type { PeriodoAnaliseRange } from "@/lib/analise/periodo-analise";

function pct(value: number | null) {
  if (value == null) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function Kpi({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "green" | "amber" | "cyan";
}) {
  const styles = {
    default: "border-at bg-white/[0.02]",
    green: "border-emerald-500/20 bg-emerald-500/[0.05]",
    amber: "border-amber-500/20 bg-amber-500/[0.05]",
    cyan: "border-cyan-500/20 bg-cyan-500/[0.05]",
  };
  return (
    <div className={cn("rounded-2xl border p-4", styles[accent])}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-at-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-at-muted">{sub}</p> : null}
    </div>
  );
}

export function IaLeiturasPainel({
  periodo,
  compact = false,
}: {
  periodo: PeriodoAnaliseRange;
  /** Versão enxuta quando ainda não há leituras finalizadas. */
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [disponivel, setDisponivel] = useState(true);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [resumo, setResumo] = useState<IaPrecisaoResumo | null>(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        const params = new URLSearchParams({ periodo: periodo.preset });
        if (periodo.preset === "personalizado") {
          params.set("de", periodo.inicioISO.slice(0, 10));
          params.set("ate", periodo.fimISO.slice(0, 10));
        }
        const res = await fetch(`/api/analise/ia-leituras?${params.toString()}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (cancel) return;
        if (!res.ok) {
          setErro(typeof data.error === "string" ? data.error : "Erro ao carregar precisão da IA.");
          setResumo(null);
          return;
        }
        setDisponivel(Boolean(data.disponivel));
        setMotivo(typeof data.motivo === "string" ? data.motivo : null);
        setResumo(data.resumo ?? null);
      } catch {
        if (!cancel) setErro("Erro de conexão ao carregar precisão da IA.");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    void load();
    return () => {
      cancel = true;
    };
  }, [periodo.preset, periodo.inicioISO, periodo.fimISO]);

  const semFinalizadas = Boolean(resumo && resumo.finalizadas === 0);
  const usarCompacto = compact && !loading && !erro && disponivel && semFinalizadas;

  if (usarCompacto && resumo) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-300" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">Leitura IA</p>
            <p className="text-xs text-at-muted">
              {resumo.total} leitura{resumo.total === 1 ? "" : "s"} · {resumo.pendentes} pendente
              {resumo.pendentes === 1 ? "" : "s"} · {resumo.rejeitadas} rejeitada
              {resumo.rejeitadas === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <p className="text-xs text-at-muted">Finalize coletas com foto pra medir acerto.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
          <Sparkles className="h-5 w-5 text-violet-300" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Precisão da leitura IA</h3>
          <p className="mt-0.5 text-sm text-at-muted">
            Acurácia das leituras de contadores no período {periodo.label.toLowerCase()}.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-at-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando precisão…
        </div>
      ) : erro ? (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      ) : !disponivel ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {motivo ?? "Relatório indisponível — configure ai_readings no Supabase."}
        </p>
      ) : resumo ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Leituras no período" value={String(resumo.total)} sub={`${resumo.finalizadas} finalizadas`} />
            <Kpi
              label="Acerto exato da IA"
              value={pct(resumo.taxaAcertoIa)}
              sub={`${resumo.aprovadasIa} aprovadas sem correção`}
              accent="green"
            />
            <Kpi
              label="Correção manual"
              value={pct(resumo.taxaCorrecaoManual)}
              sub={`${resumo.corrigidasManual} revisadas pelo operador`}
              accent="amber"
            />
            <Kpi
              label="Score médio"
              value={resumo.scoreMedio != null ? `${resumo.scoreMedio}/100` : "—"}
              sub={
                resumo.confiancaMedia != null
                  ? `Confiança média ${resumo.confiancaMedia}%`
                  : undefined
              }
              accent="cyan"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-at bg-black/20 px-3 py-2.5 text-sm">
              <span className="text-at-muted">Exceções de contador</span>
              <p className="mt-0.5 font-semibold text-white">{resumo.comExcecaoContador}</p>
            </div>
            <div className="rounded-xl border border-at bg-black/20 px-3 py-2.5 text-sm">
              <span className="text-at-muted">Manutenção detectada</span>
              <p className="mt-0.5 font-semibold text-white">{resumo.comManutencaoDetectada}</p>
            </div>
            <div className="rounded-xl border border-at bg-black/20 px-3 py-2.5 text-sm">
              <span className="text-at-muted">Pendentes / rejeitadas</span>
              <p className="mt-0.5 font-semibold text-white">
                {resumo.pendentes} / {resumo.rejeitadas}
              </p>
            </div>
          </div>

          {resumo.flagsFrequentes.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-at-muted">
                Flags mais frequentes
              </p>
              <div className="flex flex-wrap gap-2">
                {resumo.flagsFrequentes.map((item) => (
                  <span
                    key={item.flag}
                    className="rounded-full border border-at-soft bg-black/20 px-2.5 py-1 text-[11px] text-at-primary/85"
                  >
                    {item.flag} · {item.count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {resumo.porDia.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-at-muted">
                Evolução diária
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="text-at-muted">
                      <th className="px-2 py-1.5 font-medium">Dia</th>
                      <th className="px-2 py-1.5 font-medium">Total</th>
                      <th className="px-2 py-1.5 font-medium">IA ok</th>
                      <th className="px-2 py-1.5 font-medium">Correção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.porDia.map((dia) => (
                      <tr key={dia.dia} className="border-t border-white/[0.04] text-at-primary/85">
                        <td className="px-2 py-1.5 tabular-nums">
                          {dia.dia.split("-").reverse().join("/")}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{dia.total}</td>
                        <td className="px-2 py-1.5 tabular-nums text-emerald-300">{dia.acertoIa}</td>
                        <td className="px-2 py-1.5 tabular-nums text-amber-300">{dia.correcao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {resumo.finalizadas === 0 ? (
            <p className="text-sm text-at-muted">
              Ainda não há leituras IA finalizadas neste período. Faça coletas com foto e leitura
              automática para começar a medir a precisão.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
