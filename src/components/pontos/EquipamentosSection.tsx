"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { EquipamentosList } from "@/components/pontos/EquipamentosList";
import { EquipamentosForm } from "@/components/pontos/EquipamentosForm";
import { AlocarEquipamentoEstoqueButton } from "@/components/pontos/AlocarEquipamentoEstoqueButton";
import {
  createEmptyEquipamento,
  validateEquipamento,
  type AlocacaoBrindeCadastro,
  type EquipamentoInput,
  type EquipamentoTipo,
} from "@/lib/equipamentos";
import { salvarFotoEquipamento } from "@/lib/equipamentos/salvar-foto-equipamento";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { EQUIPAMENTO_NICHO, filterEquipamentosPorNicho } from "@/lib/assinatura";
import type { Equipamento, Nicho } from "@/lib/types/database";
import type { EstoqueBrindePonto } from "@/lib/estoque/brindes-ponto";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";

import type { ChamadoResumoEquipamento } from "@/lib/chamados/types";

function equipamentoInicial(nichoFiltro?: Nicho): EquipamentoInput {
  const base = createEmptyEquipamento(1);
  if (!nichoFiltro || nichoFiltro === "outros") return base;
  const tipo = (Object.entries(EQUIPAMENTO_NICHO).find(
    ([, nicho]) => nicho === nichoFiltro
  )?.[0] ?? "") as EquipamentoTipo | "";
  // Diversão tem vários tipos — deixa o usuário escolher.
  if (nichoFiltro === "diversao") return base;
  return { ...base, tipo };
}

interface EquipamentosSectionProps {
  pontoId: string;
  equipamentos: Equipamento[];
  estoqueDisponivel?: Equipamento[];
  outrosPontos?: { id: string; nome: string }[];
  nichosAtivos?: Nicho[];
  nichoFiltro?: Nicho;
  chamadosAbertos?: ChamadoResumoEquipamento[];
  estoqueBrindesPonto?: EstoqueBrindePonto[];
  estoqueCentral?: {
    id: string;
    nome_item: string;
    custo_unitario: number;
    quantidade: number;
    foto_url?: string | null;
  }[];
}

async function aplicarAlocacaoBrinde(
  pontoId: string,
  equipamentoId: string,
  alocacao: AlocacaoBrindeCadastro | undefined
): Promise<string | null> {
  if (!alocacao || alocacao.modo === "nenhum") return null;

  if (alocacao.modo === "avulso") {
    if (!alocacao.itens.length) {
      return "Adicione ao menos um item para alocar nesta máquina.";
    }
    for (const item of alocacao.itens) {
      if (!item.item_id || item.quantidade <= 0) {
        return "Informe item e quantidade válidos.";
      }
      const endpoint =
        item.source === "ponto"
          ? `/api/equipamentos/${equipamentoId}/brindes/alocar`
          : `/api/equipamentos/${equipamentoId}/brindes/alocar-central`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: item.item_id,
          quantidade: item.quantidade,
        }),
      });
      const data = await res.json();
      if (!res.ok) return data.error ?? "Erro ao alocar item na máquina.";
    }
    return null;
  }

  if (alocacao.modo === "kit") {
    if (!alocacao.kit_id) return "Selecione um kit.";

    const kitRes = await fetch(`/api/pontos/${pontoId}/kit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ kit_id: alocacao.kit_id }),
    });
    const kitData = await kitRes.json();
    if (!kitRes.ok) return kitData.error ?? "Erro ao instalar kit no ponto.";

    const pool = normalizarEstoqueBrindesPonto(kitData.estoque_brindes);
    for (const item of pool) {
      if (!item.item_id || item.quantidade <= 0) continue;
      const res = await fetch(`/api/equipamentos/${equipamentoId}/brindes/alocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: item.item_id,
          quantidade: item.quantidade,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return (
          data.error ??
          `Kit instalado no ponto, mas falhou ao transferir "${item.nome}" para a máquina.`
        );
      }
    }
    return null;
  }

  return null;
}

export function EquipamentosSection({
  pontoId,
  equipamentos,
  estoqueDisponivel = [],
  outrosPontos,
  nichosAtivos,
  nichoFiltro,
  chamadosAbertos = [],
  estoqueBrindesPonto = [],
  estoqueCentral = [],
}: EquipamentosSectionProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<EquipamentoInput[]>(() => [
    equipamentoInicial(nichoFiltro),
  ]);

  const equipamentosVisiveis = nichoFiltro
    ? filterEquipamentosPorNicho(equipamentos, nichoFiltro)
    : equipamentos;
  const estoqueVisivel = nichoFiltro
    ? filterEquipamentosPorNicho(estoqueDisponivel, nichoFiltro)
    : estoqueDisponivel;
  const nichosForm = nichoFiltro ? [nichoFiltro] : nichosAtivos;

  async function handleSave() {
    setError("");
    for (const eq of items) {
      const err = validateEquipamento(eq);
      if (err) {
        setError(err);
        return;
      }
      const aloc = eq.alocacaoBrinde;
      if (aloc?.modo === "avulso" && !aloc.itens.length) {
        setError("Adicione ao menos um item no estoque desta máquina, ou escolha Depois.");
        return;
      }
      if (aloc?.modo === "kit" && !aloc.kit_id) {
        setError("Selecione o kit para alocar.");
        return;
      }
    }

    setLoading(true);

    try {
      const nextItems = [...items];
      const { encontrarSerieDuplicadaNoLote } = await import(
        "@/lib/equipamentos/serie-unica"
      );
      const serieDup = encontrarSerieDuplicadaNoLote(
        nextItems.map((eq) => eq.numero_serie)
      );
      if (serieDup) {
        setError(
          `Número de série "${serieDup}" repetido neste formulário. Cada máquina precisa de série única.`
        );
        setLoading(false);
        return;
      }

      for (let i = 0; i < nextItems.length; i++) {
        const eq = nextItems[i];
        let equipamentoId = eq.idCriado;

        if (!equipamentoId) {
          const { alocacaoBrinde: _a, fotoFile: _f, fotoPreview: _p, ...body } = eq;
          const res = await fetch(`/api/pontos/${pontoId}/equipamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error ?? "Erro ao salvar equipamento");
            setItems(nextItems);
            setLoading(false);
            return;
          }

          equipamentoId = (data.equipamento as { id?: string } | undefined)?.id;
          if (!equipamentoId) {
            setError("Equipamento criado sem id. Tente novamente.");
            setItems(nextItems);
            setLoading(false);
            return;
          }

          nextItems[i] = { ...eq, idCriado: equipamentoId };
        }

        if (eq.fotoFile) {
          const foto = await salvarFotoEquipamento(equipamentoId, eq.fotoFile);
          if (!foto.ok) {
            setItems(nextItems);
            setError(
              `Equipamento já está salvo. A foto falhou: ${foto.error}. Clique em Salvar de novo só para enviar a foto.`
            );
            setLoading(false);
            return;
          }
        }

        const alocPend = nextItems[i].alocacaoBrinde;
        if (alocPend && alocPend.modo !== "nenhum") {
          const alocErr = await aplicarAlocacaoBrinde(pontoId, equipamentoId, alocPend);
          if (alocErr) {
            setItems(
              nextItems.map((item, idx) =>
                idx === i ? { ...item, alocacaoBrinde: { modo: "nenhum" } } : item
              )
            );
            setError(
              `Equipamento salvo. Alocação parcial: ${alocErr}. Ajuste os brindes nos detalhes da máquina.`
            );
            setLoading(false);
            router.refresh();
            return;
          }
          nextItems[i] = { ...nextItems[i], alocacaoBrinde: { modo: "nenhum" } };
        }
      }

      setShowForm(false);
      setItems([equipamentoInicial(nichoFiltro)]);
      router.refresh();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const temCassino = equipamentosVisiveis.some((e) => e.tipo === "cassino");
  const temUrsoNovo = equipamentosVisiveis.some((e) => e.tipo === "ursinho");
  const temUrso = equipamentosVisiveis.some((e) => e.tipo === "vending_ursinho");
  const temFura = equipamentosVisiveis.some((e) => e.tipo === "fura_fura");
  const temBolinha = equipamentosVisiveis.some((e) => e.tipo === "bolinha");
  const multiModulo = [temCassino, temUrsoNovo, temUrso, temFura, temBolinha].filter(
    Boolean
  ).length > 1;

  return (
    <>
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-white">Equipamentos</h2>
          {!showForm && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <AlocarEquipamentoEstoqueButton
                pontoId={pontoId}
                estoqueDisponivel={estoqueVisivel}
              />
              <button
                type="button"
                onClick={() => {
                  setItems([equipamentoInicial(nichoFiltro)]);
                  setError("");
                  setShowForm(true);
                }}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary-neon px-3 text-xs font-semibold text-slate-900 hover:bg-cyan-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Cadastrar novo
              </button>
            </div>
          )}
        </div>

        {!showForm && (
          <>
            {multiModulo && (
              <p className="text-xs text-at-muted -mt-2">
                Equipamentos agrupados por nicho — cada módulo com regras próprias.
              </p>
            )}
            <EquipamentosList
              equipamentos={equipamentosVisiveis}
              pontoId={pontoId}
              outrosPontos={outrosPontos}
              chamadosAbertos={chamadosAbertos}
              estoqueBrindesPonto={estoqueBrindesPonto}
              estoqueCentral={estoqueCentral}
            />
          </>
        )}

        {showForm && (
          <div className="space-y-4 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-at-muted">Cadastrar novo equipamento</p>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                className="rounded p-1 text-at-muted hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <EquipamentosForm
              equipamentos={items}
              onChange={setItems}
              allowMultiple={false}
              nichosAtivos={nichosForm}
              pontoId={pontoId}
              estoqueBrindesPonto={estoqueBrindesPonto}
              estoqueCentral={estoqueCentral}
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-lg bg-primary-neon py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar equipamento"}
            </button>
          </div>
        )}
      </div>

      <LoadingOverlay show={loading} message="Salvando equipamento..." />
    </>
  );
}
