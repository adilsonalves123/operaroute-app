"use client";

import { Plus, Trash2 } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { SelectCard } from "@/components/ui/SelectCard";
import {
  EQUIPAMENTO_TIPOS,
  formatContadorInput,
  type EquipamentoInput,
  type EquipamentoTipo,
} from "@/lib/equipamentos";
import { filterEquipamentoTiposPorNicho } from "@/lib/assinatura";
import type { Nicho } from "@/lib/types/database";
import { Gamepad2, Box, CircleDot } from "lucide-react";

const tipoIcons = {
  cassino: <Gamepad2 className="h-5 w-5" />,
  vending_ursinho: <Box className="h-5 w-5" />,
  fura_fura: <CircleDot className="h-5 w-5" />,
};

interface EquipamentosFormProps {
  equipamentos: EquipamentoInput[];
  onChange: (equipamentos: EquipamentoInput[]) => void;
  allowMultiple?: boolean;
  nichosAtivos?: Nicho[];
}

export function EquipamentosForm({
  equipamentos,
  onChange,
  allowMultiple = true,
  nichosAtivos,
}: EquipamentosFormProps) {
  const tiposDisponiveis = filterEquipamentoTiposPorNicho(EQUIPAMENTO_TIPOS, nichosAtivos);
  function update(id: string, field: keyof EquipamentoInput, value: string) {
    onChange(
      equipamentos.map((eq) => {
        if (eq.id !== id) return eq;
        const next = { ...eq, [field]: value };
        if (field === "tipo") {
          next.numero_entrada = "";
          next.numero_saida = "";
          next.entrada_atual = "";
        }
        return next;
      })
    );
  }

  function updateContador(
    id: string,
    field: "numero_entrada" | "numero_saida" | "entrada_atual",
    raw: string
  ) {
    update(id, field, formatContadorInput(raw));
  }

  function addEquipamento() {
    onChange([
      ...equipamentos,
      {
        id: crypto.randomUUID(),
        numero_maquina: "",
        nome: "",
        tipo: "",
        numero_entrada: "",
        numero_saida: "",
        entrada_atual: "",
        observacao: "",
      },
    ]);
  }

  function removeEquipamento(id: string) {
    onChange(equipamentos.filter((eq) => eq.id !== id));
  }

  return (
    <div className="space-y-4">
      {allowMultiple && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Equipamentos</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cadastre cassino, ursinho, vending ou fura-fura
            </p>
          </div>
          <button
            type="button"
            onClick={addEquipamento}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-primary-neon hover:bg-blue-500/10"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
      )}

      {equipamentos.length === 0 ? (
        allowMultiple ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            Nenhum equipamento. Clique em Adicionar para cadastrar máquinas neste ponto.
          </div>
        ) : null
      ) : (
        <div className="space-y-4">
          {equipamentos.map((eq, index) => (
            <div key={eq.id} className="glass-card p-4 space-y-4 border border-blue-500/10">
              {allowMultiple && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">
                    Equipamento {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEquipamento(eq.id)}
                    className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Nicho *</p>
                <p className="text-xs text-slate-500">
                  Escolha o tipo de equipamento antes de preencher os demais campos.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tiposDisponiveis.map((tipo) => (
                    <SelectCard
                      key={tipo.id}
                      label={tipo.label}
                      description={tipo.description}
                      selected={eq.tipo === tipo.id}
                      onClick={() => update(eq.id, "tipo", tipo.id)}
                      icon={tipoIcons[tipo.id as EquipamentoTipo]}
                    />
                  ))}
                </div>
              </div>

              {eq.tipo && (
                <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  label="Número da máquina *"
                  placeholder="Ex: 01, A12"
                  value={eq.numero_maquina}
                  onChange={(e) => update(eq.id, "numero_maquina", e.target.value)}
                />
                <FormInput
                  label="Nome *"
                  placeholder="Ex: Slot principal, Máquina da esquina"
                  value={eq.nome}
                  onChange={(e) => update(eq.id, "nome", e.target.value)}
                />
              </div>

              {eq.tipo === "cassino" && (
                <>
                  <p className="text-xs text-slate-500">
                    Leitura atual do painel. Na próxima coleta, esses valores viram entrada/saída
                    anterior.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormInput
                      label="Entrada atual *"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={eq.numero_entrada}
                      onChange={(e) => updateContador(eq.id, "numero_entrada", e.target.value)}
                    />
                    <FormInput
                      label="Saída atual *"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={eq.numero_saida}
                      onChange={(e) => updateContador(eq.id, "numero_saida", e.target.value)}
                    />
                  </div>
                </>
              )}

              {eq.tipo === "vending_ursinho" && (
                <FormInput
                  label="Entrada atual (visor) *"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={eq.entrada_atual}
                  onChange={(e) => updateContador(eq.id, "entrada_atual", e.target.value)}
                  hint="Leitura atual — na coleta vira valor anterior"
                />
              )}

              {eq.tipo === "fura_fura" && (
                <p className="text-xs text-slate-500">
                  A coleta registra furos feitos no ponto. Não é necessário informar leitura de
                  painel.
                </p>
              )}

              <FormTextarea
                label="Observação"
                value={eq.observacao}
                onChange={(e) => update(eq.id, "observacao", e.target.value)}
              />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
