"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PackagePlus, X } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { getEquipamentoTipoLabel } from "@/lib/equipamentos";
import { normalizarNumeroSerie } from "@/lib/equipamentos/numero-serie";
import type { Equipamento } from "@/lib/types/database";

type Props = {
  pontoId: string;
  estoqueDisponivel: Equipamento[];
};

function labelOpcao(eq: Equipamento): string {
  const nome = eq.nome.trim() || "Sem nome";
  const tipo = getEquipamentoTipoLabel(eq.tipo);
  const serie = eq.numero_serie?.trim();
  return serie ? `${nome} — ${tipo} · ${serie}` : `${nome} — ${tipo}`;
}

export function AlocarEquipamentoEstoqueButton({ pontoId, estoqueDisponivel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [equipamentoId, setEquipamentoId] = useState("");
  const [numeroMaquina, setNumeroMaquina] = useState("");
  const [buscaSerie, setBuscaSerie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtrados = useMemo(() => {
    const q = normalizarNumeroSerie(buscaSerie);
    if (!q) return estoqueDisponivel;
    return estoqueDisponivel.filter((eq) => {
      const serie = normalizarNumeroSerie(eq.numero_serie ?? "");
      const nome = eq.nome.trim().toLowerCase();
      const num = (eq.numero_maquina ?? "").trim().toLowerCase();
      return serie.includes(q) || nome.includes(q) || num.includes(q);
    });
  }, [estoqueDisponivel, buscaSerie]);

  const selecionado = estoqueDisponivel.find((eq) => eq.id === equipamentoId);

  if (estoqueDisponivel.length === 0) {
    return (
      <p className="text-xs text-slate-500 self-center">
        Nenhum equipamento no estoque. Cadastre em{" "}
        <a href="/equipamentos" className="text-cyan-400 hover:underline">
          Máquinas e equipamentos
        </a>
        .
      </p>
    );
  }

  function fechar() {
    if (loading) return;
    setOpen(false);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipamentoId) {
      setError("Selecione um equipamento.");
      return;
    }
    if (!numeroMaquina.trim()) {
      setError("Informe o nº no ponto.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/equipamentos/${equipamentoId}/alocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ponto_id: pontoId,
          numero_maquina: numeroMaquina.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao alocar.");
        return;
      }
      setOpen(false);
      setEquipamentoId("");
      setNumeroMaquina("");
      setBuscaSerie("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alocar.");
    } finally {
      setLoading(false);
    }
  }

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
            onClick={fechar}
          >
            <form
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md space-y-4 rounded-xl border border-cyan-500/25 bg-slate-900 p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">Alocar equipamento do estoque</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Digite a série ou escolha na lista e defina o nº neste ponto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fechar}
                  disabled={loading}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <FormInput
                label="Buscar por série / nome"
                value={buscaSerie}
                onChange={(e) => {
                  const v = e.target.value;
                  setBuscaSerie(v);
                  const q = normalizarNumeroSerie(v);
                  if (!q) return;
                  const match = estoqueDisponivel.find(
                    (eq) => normalizarNumeroSerie(eq.numero_serie ?? "") === q
                  );
                  if (match) {
                    setEquipamentoId(match.id);
                    if (!numeroMaquina.trim()) {
                      setNumeroMaquina(
                        match.numero_maquina?.trim() || match.numero_serie?.trim() || ""
                      );
                    }
                  }
                }}
                placeholder="Ex.: SN123456"
                hint="Se a série bater exatamente, a máquina é selecionada sozinha."
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">Equipamento *</label>
                <select
                  value={equipamentoId}
                  onChange={(e) => {
                    setEquipamentoId(e.target.value);
                    const eq = estoqueDisponivel.find((x) => x.id === e.target.value);
                    if (eq && !numeroMaquina.trim()) {
                      setNumeroMaquina(
                        eq.numero_maquina?.trim() || eq.numero_serie?.trim() || ""
                      );
                    }
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {filtrados.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {labelOpcao(eq)}
                    </option>
                  ))}
                </select>
                {filtrados.length === 0 && (
                  <p className="text-xs text-amber-300/90">
                    Nenhuma máquina no estoque com essa busca.
                  </p>
                )}
                {selecionado && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                    <p className="font-medium text-slate-200">
                      {selecionado.nome.trim() || "Sem nome"}
                    </p>
                    <p className="mt-0.5">
                      {getEquipamentoTipoLabel(selecionado.tipo)}
                      {selecionado.numero_serie?.trim()
                        ? ` · série ${selecionado.numero_serie.trim()}`
                        : ""}
                    </p>
                    {selecionado.observacao?.trim() && (
                      <p className="mt-1 text-slate-500">{selecionado.observacao.trim()}</p>
                    )}
                  </div>
                )}
              </div>

              <FormInput
                label="Nº no ponto *"
                value={numeroMaquina}
                onChange={(e) => setNumeroMaquina(e.target.value)}
                placeholder="Ex.: 1, 2, A..."
                hint="Numeração deste equipamento neste comércio"
              />

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {loading ? "Alocando..." : "Alocar neste ponto"}
                </button>
                <button
                  type="button"
                  onClick={fechar}
                  disabled={loading}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-cyan-500/30 px-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
      >
        <PackagePlus className="h-3.5 w-3.5" />
        Alocar do estoque
      </button>
      {modal}
    </>
  );
}
