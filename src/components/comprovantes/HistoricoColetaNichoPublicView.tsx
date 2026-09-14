"use client";

import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { ComprovantePublicView } from "@/components/comprovantes/ComprovantePublicView";
import { formatContador } from "@/lib/nichos/cassino";
import type { ComprovanteSnapshot } from "@/lib/comprovantes/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type CalculoNichoComum = {
  valorBruto?: number;
  valorComissao?: number;
  comissaoPercentual?: number;
  desconto?: number;
  valorAReceber?: number;
  lucroReal?: number;
  valorPagoRecebido?: number;
  saldoPendente?: number;
  haver?: number;
  custoBrindes?: number;
  quantidadeFuros?: number;
  precoFuro?: number;
  modoComissao?: string;
};

type MaquinaEntrada = {
  nome: string;
  entradaAnterior?: number;
  entradaAtual?: number;
  entradaPeriodo?: number;
  valorBruto?: number;
  custoBrindes?: number;
  lucroReal?: number;
  fotoUrl?: string | null;
};

type MaquinaBolinha = MaquinaEntrada & {
  valorContado?: number;
  precoJogada?: number;
  unidadesSaiu?: number;
};

type ExpositorLinha = {
  nome: string;
  codigo?: string | null;
  vendido: number;
  precoVenda: number;
  receita: number;
  comissao?: number;
};

type Expositor = {
  nome: string;
  linhas: ExpositorLinha[];
  valorBruto?: number;
  fotoUrl?: string | null;
};

type PayloadNicho = {
  pontoNome?: string;
  empresaNome?: string;
  data?: string | Date;
  previa?: boolean;
  kitNome?: string | null;
  fotoUrl?: string | null;
  calculo?: CalculoNichoComum;
  maquinas?: MaquinaBolinha[];
  expositores?: Expositor[];
  observacao?: string | null;
};

function asDateIso(value: unknown, fallback: string): string {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return fallback;
}

function MetricBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; tone?: "emerald" | "rose" | "slate" }[];
}) {
  return (
    <div className="space-y-1.5 rounded-xl bg-slate-900/70 p-3 text-xs">
      <p className="font-medium text-at-primary/85">{title}</p>
      {rows.map((r) => (
        <div
          key={r.label}
          className={`flex justify-between gap-2 ${
            r.tone === "emerald"
              ? "border-t border-slate-800 pt-1.5 text-emerald-400"
              : r.tone === "rose"
                ? "border-t border-slate-800 pt-1.5 text-rose-400"
                : "text-at-muted"
          }`}
        >
          <span>{r.label}</span>
          <span className={`tabular-nums ${r.tone ? "font-medium" : ""}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function ResumoFinanceiroNicho({
  c,
  nichoLabel,
}: {
  c: CalculoNichoComum;
  nichoLabel: string;
}) {
  const aReceber = Number(c.valorAReceber ?? 0);
  const pendente = Number(c.saldoPendente ?? 0);
  const recebido = Number(c.valorPagoRecebido ?? 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.08] to-transparent">
      <div className="border-b border-emerald-500/15 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">
          Resultado · {nichoLabel}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-white">
          {formatCurrency(aReceber)}
        </p>
        <p className="mt-1 text-xs text-at-muted">Valor a receber nesta coleta</p>
      </div>
      <div className="space-y-2 px-4 py-3 text-sm">
        {c.quantidadeFuros != null && (
          <div className="flex justify-between gap-3 text-at-muted">
            <span>
              Furos
              {c.precoFuro != null ? ` × ${formatCurrency(c.precoFuro)}` : ""}
            </span>
            <span className="tabular-nums text-at-primary/90">{c.quantidadeFuros}</span>
          </div>
        )}
        {Number(c.valorBruto ?? 0) > 0.009 && (
          <div className="flex justify-between gap-3 text-at-muted">
            <span>Arrecadação bruta</span>
            <span className="tabular-nums text-at-primary/90">
              {formatCurrency(Number(c.valorBruto))}
            </span>
          </div>
        )}
        {Number(c.valorComissao ?? 0) > 0.009 && (
          <div className="flex justify-between gap-3 text-at-muted">
            <span>
              {c.modoComissao === "tabela"
                ? "Repasse ao cliente"
                : `Comissão${c.comissaoPercentual != null ? ` (${c.comissaoPercentual}%)` : ""}`}
            </span>
            <span className="tabular-nums text-orange-300">
              {formatCurrency(Number(c.valorComissao))}
            </span>
          </div>
        )}
        {Number(c.desconto ?? 0) > 0.009 && (
          <div className="flex justify-between gap-3 text-at-muted">
            <span>Desconto</span>
            <span className="tabular-nums text-orange-300">
              − {formatCurrency(Number(c.desconto))}
            </span>
          </div>
        )}
        {Number(c.custoBrindes ?? 0) > 0.009 && (
          <div className="flex justify-between gap-3 text-at-muted">
            <span>Custo brindes</span>
            <span className="tabular-nums text-at-primary/90">
              {formatCurrency(Number(c.custoBrindes))}
            </span>
          </div>
        )}
        {Number(c.lucroReal ?? 0) > 0.009 && (
          <div className="flex justify-between gap-3 border-t border-at pt-2 text-at-muted">
            <span>Lucro</span>
            <span className="tabular-nums font-semibold text-emerald-400">
              {formatCurrency(Number(c.lucroReal))}
            </span>
          </div>
        )}
        {recebido > 0.009 && (
          <div className="flex justify-between gap-3 text-at-muted">
            <span>Recebido agora</span>
            <span className="tabular-nums text-green-400">{formatCurrency(recebido)}</span>
          </div>
        )}
        {pendente > 0.009 && (
          <div className="flex justify-between gap-3 text-amber-300/90">
            <span>Saldo pendente</span>
            <span className="tabular-nums font-semibold">{formatCurrency(pendente)}</span>
          </div>
        )}
        {Number(c.haver ?? 0) > 0.009 && (
          <div className="flex justify-between gap-3 text-cyan-300/90">
            <span>Haver do ponto</span>
            <span className="tabular-nums font-semibold">
              {formatCurrency(Number(c.haver))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const NICHO_LABEL: Record<string, string> = {
  fura_fura: "Fura-Fura",
  ursinho: "Ursinho",
  diversao: "Diversão",
  bolinha: "Bolinha",
  consignado: "Consignado",
};

/**
 * Link público detalhado dos nichos (exceto cassino) —
 * mesmo layout do histórico cassino: resultado + itens + fotos.
 */
export function HistoricoColetaNichoPublicView({
  snapshot,
}: {
  snapshot: ComprovanteSnapshot;
}) {
  const nicho = snapshot.nichoModulo ?? "";
  const raw = snapshot.relatorio as PayloadNicho | undefined;
  if (!raw?.calculo) {
    return <ComprovantePublicView snapshot={snapshot} />;
  }

  const c = raw.calculo;
  const dataIso = asDateIso(raw.data, snapshot.dataIso);
  const pendente = Number(c.saldoPendente ?? 0) > 0.009;
  const quitada =
    !pendente &&
    Number(c.valorPagoRecebido ?? 0) > 0.009 &&
    Number(c.valorAReceber ?? 0) > 0.009;
  const label = NICHO_LABEL[nicho] ?? "Coleta";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {raw.pontoNome || snapshot.pontoNome}
          </h1>
          {pendente && <AlertBadge variant="warning">Pagamento pendente</AlertBadge>}
          {quitada && <AlertBadge variant="success">Quitada</AlertBadge>}
          {raw.previa && <AlertBadge variant="info">Prévia</AlertBadge>}
        </div>
        <p className="text-sm text-at-muted">{formatDateTime(dataIso)}</p>
        {raw.kitNome && (
          <p className="text-xs text-at-muted">Kit: {raw.kitNome}</p>
        )}
      </div>

      <ResumoFinanceiroNicho c={c} nichoLabel={label} />

      {nicho === "fura_fura" && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
            <div>
              <p className="font-medium text-white">
                Fura-Fura{raw.kitNome ? ` · ${raw.kitNome}` : ""}
              </p>
            </div>
            <p className="text-base font-semibold tabular-nums text-emerald-400">
              {formatCurrency(Number(c.valorAReceber ?? 0))}
            </p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <MetricBox
              title="Operação"
              rows={[
                { label: "Furos", value: String(c.quantidadeFuros ?? 0) },
                {
                  label: "Preço / furo",
                  value: formatCurrency(Number(c.precoFuro ?? 0)),
                },
                {
                  label: "Bruto",
                  value: formatCurrency(Number(c.valorBruto ?? 0)),
                  tone: "emerald",
                },
              ]}
            />
            <MetricBox
              title="Acerto"
              rows={[
                {
                  label: "Comissão",
                  value: formatCurrency(Number(c.valorComissao ?? 0)),
                },
                {
                  label: "A receber",
                  value: formatCurrency(Number(c.valorAReceber ?? 0)),
                  tone: "emerald",
                },
              ]}
            />
          </div>
          {raw.fotoUrl && (
            <div className="border-t border-slate-800/80 p-3">
              <ExpandableImage
                src={raw.fotoUrl}
                alt="Foto da máquina"
                className="max-h-52 rounded-xl"
              />
            </div>
          )}
        </div>
      )}

      {(nicho === "ursinho" || nicho === "diversao") &&
        Array.isArray(raw.maquinas) &&
        raw.maquinas.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">
              Máquinas{" "}
              <span className="font-normal text-at-muted">
                ({raw.maquinas.length})
              </span>
            </h2>
            {raw.maquinas.map((m, i) => (
              <div
                key={`${m.nome}-${i}`}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
                  <p className="font-medium text-white">{m.nome}</p>
                  <p className="text-base font-semibold tabular-nums text-emerald-400">
                    {formatCurrency(Number(m.valorBruto ?? m.lucroReal ?? 0))}
                  </p>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  <MetricBox
                    title="Entrada"
                    rows={[
                      {
                        label: "Anterior",
                        value: formatContador(Number(m.entradaAnterior ?? 0)),
                      },
                      {
                        label: "Atual",
                        value: formatContador(Number(m.entradaAtual ?? 0)),
                      },
                      {
                        label: "Período",
                        value: formatContador(
                          Number(
                            m.entradaPeriodo ??
                              Number(m.entradaAtual ?? 0) -
                                Number(m.entradaAnterior ?? 0)
                          )
                        ),
                        tone: "emerald",
                      },
                    ]}
                  />
                  <MetricBox
                    title="Valores"
                    rows={[
                      {
                        label: "Bruto",
                        value: formatCurrency(Number(m.valorBruto ?? 0)),
                      },
                      ...(Number(m.custoBrindes ?? 0) > 0.009
                        ? [
                            {
                              label: "Brindes",
                              value: formatCurrency(Number(m.custoBrindes)),
                            },
                          ]
                        : []),
                      {
                        label: "Lucro",
                        value: formatCurrency(Number(m.lucroReal ?? 0)),
                        tone: "emerald" as const,
                      },
                    ]}
                  />
                </div>
                {m.fotoUrl && (
                  <div className="border-t border-slate-800/80 p-3">
                    <ExpandableImage
                      src={m.fotoUrl}
                      alt={`Foto ${m.nome}`}
                      className="max-h-52 rounded-xl"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {nicho === "bolinha" &&
        Array.isArray(raw.maquinas) &&
        raw.maquinas.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">
              Máquinas{" "}
              <span className="font-normal text-at-muted">
                ({raw.maquinas.length})
              </span>
            </h2>
            {raw.maquinas.map((m, i) => (
              <div
                key={`${m.nome}-${i}`}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
                  <p className="font-medium text-white">{m.nome}</p>
                  <p className="text-base font-semibold tabular-nums text-emerald-400">
                    {formatCurrency(Number(m.valorBruto ?? 0))}
                  </p>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  <MetricBox
                    title="Contagem"
                    rows={[
                      {
                        label: "Contado",
                        value: formatCurrency(Number(m.valorContado ?? 0)),
                      },
                      {
                        label: "Preço jogada",
                        value: formatCurrency(Number(m.precoJogada ?? 0)),
                      },
                      {
                        label: "Saiu",
                        value: String(m.unidadesSaiu ?? 0),
                        tone: "rose",
                      },
                    ]}
                  />
                  <MetricBox
                    title="Entrada (visor)"
                    rows={[
                      {
                        label: "Anterior",
                        value: formatContador(Number(m.entradaAnterior ?? 0)),
                      },
                      {
                        label: "Atual",
                        value: formatContador(Number(m.entradaAtual ?? 0)),
                      },
                      {
                        label: "Período",
                        value: formatContador(
                          Number(
                            m.entradaPeriodo ??
                              Number(m.entradaAtual ?? 0) -
                                Number(m.entradaAnterior ?? 0)
                          )
                        ),
                        tone: "emerald",
                      },
                    ]}
                  />
                </div>
                {m.fotoUrl && (
                  <div className="border-t border-slate-800/80 p-3">
                    <ExpandableImage
                      src={m.fotoUrl}
                      alt={`Foto ${m.nome}`}
                      className="max-h-52 rounded-xl"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {nicho === "consignado" &&
        Array.isArray(raw.expositores) &&
        raw.expositores.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">
              Expositores{" "}
              <span className="font-normal text-at-muted">
                ({raw.expositores.length})
              </span>
            </h2>
            {raw.expositores.map((exp, i) => (
              <div
                key={`${exp.nome}-${i}`}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
                  <p className="font-medium text-white">{exp.nome}</p>
                  <p className="text-base font-semibold tabular-nums text-emerald-400">
                    {formatCurrency(Number(exp.valorBruto ?? 0))}
                  </p>
                </div>
                <div className="space-y-2 p-4 text-sm">
                  {(exp.linhas ?? [])
                    .filter((l) => Number(l.vendido) > 0)
                    .map((l, j) => (
                      <div
                        key={`${l.nome}-${j}`}
                        className="flex justify-between gap-3 rounded-lg bg-slate-900/60 px-3 py-2"
                      >
                        <span className="text-at-primary/85">
                          {l.vendido} × {l.nome}
                          {l.codigo ? ` (${l.codigo})` : ""}
                        </span>
                        <span className="tabular-nums text-slate-100">
                          {formatCurrency(Number(l.receita ?? 0))}
                        </span>
                      </div>
                    ))}
                </div>
                {exp.fotoUrl && (
                  <div className="border-t border-slate-800/80 p-3">
                    <ExpandableImage
                      src={exp.fotoUrl}
                      alt={`Foto ${exp.nome}`}
                      className="max-h-52 rounded-xl"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {raw.observacao && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-at-muted">
            Observação
          </p>
          <p className="mt-1 text-sm text-at-primary/85">{raw.observacao}</p>
        </div>
      )}

      <p className="pt-2 text-center text-[11px] text-at-soft">OperaRout</p>
    </div>
  );
}
