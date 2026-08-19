"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { SelectCard } from "@/components/ui/SelectCard";
import { FotoEquipamento } from "@/components/pontos/FotoEquipamento";
import {
  EQUIPAMENTO_TIPOS,
  EQUIPAMENTO_TIPOS_MAQUINA,
  formatContadorInput,
  isEquipamentoTipoDiversao,
  validateEquipamento,
  createEmptyEquipamento,
  type EquipamentoInput,
  type EquipamentoTipo,
} from "@/lib/equipamentos";
import { salvarFotoEquipamento } from "@/lib/equipamentos/salvar-foto-equipamento";
import { filterEquipamentoTiposPorNicho } from "@/lib/assinatura";
import type { Nicho } from "@/lib/types/database";
import { Gamepad2, Box, CircleDot, Joystick, Armchair, Circle, Store } from "lucide-react";

const tipoIcons: Record<EquipamentoTipo, React.ReactNode> = {
  cassino: <Gamepad2 className="h-5 w-5" />,
  ursinho: <Box className="h-5 w-5" />,
  vending_ursinho: <Box className="h-5 w-5" />,
  fura_fura: <CircleDot className="h-5 w-5" />,
  sinuca: <CircleDot className="h-5 w-5" />,
  fliperama: <Joystick className="h-5 w-5" />,
  cadeira_massagem: <Armchair className="h-5 w-5" />,
  diversao: <Gamepad2 className="h-5 w-5" />,
  bolinha: <Circle className="h-5 w-5" />,
  consignado: <Store className="h-5 w-5" />,
};

type Props = {
  nichosAtivos?: Nicho[];
  onCreated?: () => void;
};

export function CadastrarEquipamentoEstoqueForm({ nichosAtivos, onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EquipamentoInput>(() => createEmptyEquipamento(1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tipos = filterEquipamentoTiposPorNicho(
    EQUIPAMENTO_TIPOS.filter((t) => t.enabled && EQUIPAMENTO_TIPOS_MAQUINA.includes(t.id)),
    nichosAtivos
  );

  function update(patch: Partial<EquipamentoInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateFoto(file: File | null) {
    setForm((prev) => {
      if (prev.fotoPreview) URL.revokeObjectURL(prev.fotoPreview);
      return {
        ...prev,
        fotoFile: file,
        fotoPreview: file ? URL.createObjectURL(file) : null,
      };
    });
  }

  function fechar() {
    if (loading) return;
    setOpen(false);
    setError("");
    document.body.style.overflow = "";
  }

  function abrir() {
    setOpen(true);
    document.body.style.overflow = "hidden";
  }

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateEquipamento(form, { modoEstoque: true });
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/equipamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome: form.nome.trim(),
          tipo: form.tipo,
          numero_serie: form.numero_serie.trim(),
          preco_jogada: form.preco_jogada || null,
          observacao: form.observacao || null,
          numero_entrada: form.numero_entrada || null,
          numero_saida: form.numero_saida || null,
          entrada_atual: form.entrada_atual || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao cadastrar equipamento.");
        return;
      }

      const equipamentoId = data.equipamento?.id as string | undefined;
      if (equipamentoId && form.fotoFile) {
        const foto = await salvarFotoEquipamento(equipamentoId, form.fotoFile);
        if (!foto.ok) {
          setError(
            `Equipamento salvo. A foto falhou: ${foto.error}. Edite o equipamento e envie a foto de novo.`
          );
          setForm(createEmptyEquipamento(1));
          onCreated?.();
          router.refresh();
          return;
        }
      }

      if (form.fotoPreview) URL.revokeObjectURL(form.fotoPreview);
      setForm(createEmptyEquipamento(1));
      setOpen(false);
      onCreated?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-2 rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/15 px-4 py-2.5 text-[13px] font-medium text-[#c4a574] transition hover:bg-[#c4a574]/22"
      >
        <Plus className="h-4 w-4" />
        Cadastrar no estoque
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/60 p-4 sm:items-center"
          onClick={fechar}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="glass-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden border border-cyan-500/20 shadow-xl"
          >
            <div className="overflow-y-auto overscroll-contain px-5 pb-4 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">Novo equipamento no estoque</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Só máquinas e expositores. Produtos e itens ficam em Estoque / Produtos consignados.
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

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-300">Nicho / tipo *</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tipos.map((t) => (
                    <SelectCard
                      key={t.id}
                      selected={form.tipo === t.id}
                      onClick={() =>
                        update({ tipo: t.id, preco_jogada: t.id === "bolinha" ? form.preco_jogada : "" })
                      }
                      icon={tipoIcons[t.id]}
                      label={t.label}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <FotoEquipamento
                  preview={form.fotoPreview ?? null}
                  onChange={updateFoto}
                  compact
                />
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <FormInput
                    label="Nome *"
                    value={form.nome}
                    onChange={(e) => update({ nome: e.target.value })}
                    placeholder="Ex.: Máquina 01 / Expositor A"
                  />
                  <FormInput
                    label="Número de série *"
                    value={form.numero_serie}
                    onChange={(e) => update({ numero_serie: e.target.value })}
                    placeholder="Série do painel / etiqueta"
                  />
                </div>
              </div>

              {form.tipo === "bolinha" && (
                <FormInput
                  label="Valor da jogada (R$) *"
                  value={form.preco_jogada}
                  onChange={(e) => update({ preco_jogada: e.target.value })}
                  placeholder="2,00"
                />
              )}

              {form.tipo && form.tipo !== "bolinha" && form.tipo !== "consignado" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <FormInput
                    label="Entrada atual (opcional)"
                    inputMode="numeric"
                    value={
                      form.tipo === "cassino"
                        ? form.numero_entrada
                        : form.tipo === "ursinho" ||
                          form.tipo === "vending_ursinho" ||
                          isEquipamentoTipoDiversao(form.tipo)
                        ? form.entrada_atual
                        : form.numero_entrada
                    }
                    onChange={(e) => {
                      const v = formatContadorInput(e.target.value);
                      if (
                        form.tipo === "ursinho" ||
                        form.tipo === "vending_ursinho" ||
                        isEquipamentoTipoDiversao(form.tipo ?? "")
                      ) {
                        update({ entrada_atual: v });
                      } else {
                        update({ numero_entrada: v });
                      }
                    }}
                    placeholder="0"
                    hint="Leitura atual do painel"
                  />
                  <FormInput
                    label="Saída atual (opcional)"
                    inputMode="numeric"
                    value={form.numero_saida}
                    onChange={(e) =>
                      update({ numero_saida: formatContadorInput(e.target.value) })
                    }
                    placeholder="0"
                    hint="Leitura atual do painel"
                  />
                </div>
              )}

              <div className="mt-4">
                <FormInput
                  label="Observação"
                  value={form.observacao}
                  onChange={(e) => update({ observacao: e.target.value })}
                  placeholder="Opcional"
                />
              </div>

              {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
            </div>

            <div className="border-t border-slate-800 bg-slate-950/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4">
              <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
              >
                {loading ? "Salvando..." : "Salvar no estoque"}
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
            </div>
          </form>
        </div>
      )}
    </>
  );
}
