"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { EquipamentosList } from "@/components/pontos/EquipamentosList";
import { EquipamentosForm } from "@/components/pontos/EquipamentosForm";
import {
  createEmptyEquipamento,
  validateEquipamento,
  type EquipamentoInput,
} from "@/lib/equipamentos";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import type { Equipamento, Nicho } from "@/lib/types/database";

interface EquipamentosSectionProps {
  pontoId: string;
  equipamentos: Equipamento[];
  outrosPontos?: { id: string; nome: string }[];
  nichosAtivos?: Nicho[];
}

export function EquipamentosSection({
  pontoId,
  equipamentos,
  outrosPontos,
  nichosAtivos,
}: EquipamentosSectionProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<EquipamentoInput[]>([
    createEmptyEquipamento(1),
  ]);

  async function handleSave() {
    setError("");
    for (const eq of items) {
      const err = validateEquipamento(eq);
      if (err) {
        setError(err);
        return;
      }
    }

    setLoading(true);

    try {
      for (const eq of items) {
        const res = await fetch(`/api/pontos/${pontoId}/equipamentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(eq),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Erro ao salvar equipamento");
          setLoading(false);
          return;
        }
      }

      setShowForm(false);
      setItems([createEmptyEquipamento(1)]);
      router.refresh();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const temCassino = equipamentos.some(
    (e) => e.tipo === "cassino" || e.tipo === "vending_ursinho"
  );
  const temFura = equipamentos.some((e) => e.tipo === "fura_fura");

  return (
    <>
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">Equipamentos</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-neon px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-cyan-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar equipamento
          </button>
        )}
      </div>

      {!showForm && (
        <>
          {temCassino && temFura && (
            <p className="text-xs text-slate-500 -mt-2">
              Máquinas agrupadas por módulo — Cassino e Fura Fura ficam separados.
            </p>
          )}
          <EquipamentosList
            equipamentos={equipamentos}
            pontoId={pontoId}
            outrosPontos={outrosPontos}
          />
        </>
      )}

      {showForm && (
        <div className="space-y-4 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Cadastrar novo equipamento</p>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="rounded p-1 text-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <EquipamentosForm
            equipamentos={items}
            onChange={setItems}
            allowMultiple={false}
            nichosAtivos={nichosAtivos}
          />

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

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
