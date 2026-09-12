"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Loader2, Minus, Plus, Package, X } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { RelatorioConsignadoView } from "./RelatorioConsignadoView";
import type { RelatorioConsignadoData } from "@/lib/nichos/consignado/relatorio";
import { snapshotFromRelatorioConsignado } from "@/lib/comprovantes/from-relatorio-nicho";
import { montarSnapshotRelatorio } from "@/lib/comprovantes/previa-relatorio";
import { CompartilharComprovanteLinkActions } from "@/components/comprovantes/CompartilharComprovanteLinkActions";
import { formatCurrency, cn } from "@/lib/utils";

export type LinhaReporConsignado = {
  produtoId: string;
  codigo: string | null;
  nome: string;
  saldoAtual: number;
  precoVenda: number;
  reporInput: string;
  fotoUrl?: string | null;
};

export type ExpositorReporConsignado = {
  equipamentoId: string;
  nome: string;
  linhas: LinhaReporConsignado[];
};

type Props = {
  open: boolean;
  data: RelatorioConsignadoData;
  expositores: ExpositorReporConsignado[];
  onClose: () => void;
};

function parseIntInput(value: string): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function ColetaConsignadoSucessoModal({ open, data, expositores, onClose }: Props) {
  const [fase, setFase] = useState<"pergunta" | "repor">("pergunta");
  const [linhasRepor, setLinhasRepor] = useState(expositores);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setFase("pergunta");
    setLinhasRepor(expositores);
    setErro("");
    setOkMsg("");
    setSaving(false);
  }, [open, expositores]);

  const totalRepor = useMemo(
    () =>
      linhasRepor.reduce(
        (acc, exp) =>
          acc + exp.linhas.reduce((s, l) => s + parseIntInput(l.reporInput), 0),
        0
      ),
    [linhasRepor]
  );

  if (!open) return null;

  function updateRepor(equipamentoId: string, produtoId: string, next: string) {
    setLinhasRepor((prev) =>
      prev.map((exp) => {
        if (exp.equipamentoId !== equipamentoId) return exp;
        return {
          ...exp,
          linhas: exp.linhas.map((l) =>
            l.produtoId === produtoId ? { ...l, reporInput: next } : l
          ),
        };
      })
    );
  }

  async function salvarRepor() {
    if (totalRepor <= 0) {
      setErro("Informe quantas unidades deseja repor.");
      return;
    }
    setSaving(true);
    setErro("");
    setOkMsg("");
    try {
      for (const exp of linhasRepor) {
        const itens = exp.linhas
          .map((l) => ({
            produto_id: l.produtoId,
            quantidade: parseIntInput(l.reporInput),
          }))
          .filter((i) => i.quantidade > 0);
        if (itens.length === 0) continue;

        const res = await fetch(`/api/equipamentos/${exp.equipamentoId}/consignado-repor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ itens }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? `Erro ao repor em ${exp.nome}.`);
        }
      }
      setOkMsg("Reposição salva no expositor.");
      window.setTimeout(() => onClose(), 700);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao repor produtos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 shrink-0 text-green-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Coleta registrada!</h2>
              <p className="text-sm text-slate-400">Comprovante detalhado abaixo</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
            <RelatorioConsignadoView data={{ ...data, previa: false }} />
          </div>

          <CompartilharComprovanteLinkActions
            snapshot={snapshotFromRelatorioConsignado({ ...data, previa: false })}
            prepareSnapshot={() =>
              montarSnapshotRelatorio({
                base: snapshotFromRelatorioConsignado({ ...data, previa: false }),
                nichoModulo: "consignado",
                relatorio: { ...data, previa: false },
                previa: false,
                layout: "historico",
              })
            }
            telefone={data.pontoWhatsapp}
            whatsappLabel="WhatsApp"
            shareLabel="Compartilhar"
          />

          {fase === "pergunta" ? (
            <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Package className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
                <div>
                  <p className="font-medium text-white">Deseja repor produtos agora?</p>
                  <p className="mt-1 text-sm text-slate-400">
                    A coleta já contabilizou o que saiu. A reposição é opcional e fica separada para
                    não confundir o recolhe.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  Não, concluir
                </button>
                <button
                  type="button"
                  onClick={() => setFase("repor")}
                  className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400"
                >
                  Sim, repor
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                Informe quantas unidades colocar de volta em cada produto.
              </p>
              {linhasRepor.map((exp) => (
                <div
                  key={exp.equipamentoId}
                  className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <p className="text-sm font-medium text-white">{exp.nome}</p>
                  {exp.linhas.map((linha) => {
                    const n = parseIntInput(linha.reporInput);
                    return (
                      <div
                        key={linha.produtoId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {linha.fotoUrl ? (
                            <ExpandableImage
                              src={linha.fotoUrl}
                              alt={linha.nome}
                              className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                              fullWidth={false}
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                              <Package className="h-4 w-4 text-slate-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">
                              {linha.codigo ? (
                                <span className="mr-1.5 text-cyan-300">{linha.codigo}</span>
                              ) : null}
                              {linha.nome}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Saldo agora: {linha.saldoAtual} · {formatCurrency(linha.precoVenda)} un
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateRepor(exp.equipamentoId, linha.produtoId, String(Math.max(0, n - 1)))
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={linha.reporInput}
                            onChange={(e) =>
                              updateRepor(
                                exp.equipamentoId,
                                linha.produtoId,
                                e.target.value.replace(/\D/g, "")
                              )
                            }
                            className="h-8 w-12 rounded-lg border border-slate-700 bg-slate-950 text-center text-sm tabular-nums text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateRepor(exp.equipamentoId, linha.produtoId, String(n + 1))
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {erro && <p className="text-sm text-red-400">{erro}</p>}
              {okMsg && <p className="text-sm text-green-400">{okMsg}</p>}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Pular
                </button>
                <button
                  type="button"
                  disabled={saving || totalRepor <= 0}
                  onClick={() => void salvarRepor()}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
                  )}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar reposição ({totalRepor})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
