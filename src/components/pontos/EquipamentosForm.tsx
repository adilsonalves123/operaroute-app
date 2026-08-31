"use client";

import { useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { SelectCard } from "@/components/ui/SelectCard";
import { FotoEquipamento } from "@/components/pontos/FotoEquipamento";
import { EquipamentoIdentificacaoFields } from "@/components/pontos/EquipamentoIdentificacaoFields";
import { AlocarBrindeCadastroEquipamento } from "@/components/pontos/AlocarBrindeCadastroEquipamento";
import {
  EQUIPAMENTO_TIPOS,
  EQUIPAMENTO_TIPOS_MAQUINA,
  formatContadorInput,
  isEquipamentoTipoComBrindes,
  isEquipamentoTipoDiversao,
  type AlocacaoBrindeCadastro,
  type EquipamentoInput,
  type EquipamentoTipo,
} from "@/lib/equipamentos";
import { filterEquipamentoTiposPorNicho } from "@/lib/assinatura";
import type { Nicho } from "@/lib/types/database";
import type { EstoqueBrindePonto } from "@/lib/estoque/brindes-ponto";
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

interface EquipamentosFormProps {
  equipamentos: EquipamentoInput[];
  onChange: (equipamentos: EquipamentoInput[]) => void;
  allowMultiple?: boolean;
  nichosAtivos?: Nicho[];
  pontoId?: string;
  estoqueBrindesPonto?: EstoqueBrindePonto[];
  estoqueCentral?: {
    id: string;
    nome_item: string;
    custo_unitario: number;
    quantidade: number;
    foto_url?: string | null;
  }[];
}

function emptyEquipamento(tipo: EquipamentoTipo | "" = ""): EquipamentoInput {
  return {
    id: crypto.randomUUID(),
    numero_maquina: "",
    numero_serie: "",
    nome: "",
    tipo,
    numero_entrada: "",
    numero_saida: "",
    entrada_atual: "",
    preco_jogada: "",
    observacao: "",
    alocacaoBrinde: { modo: "nenhum" },
  };
}

export function EquipamentosForm({
  equipamentos,
  onChange,
  allowMultiple = true,
  nichosAtivos,
  pontoId,
  estoqueBrindesPonto = [],
  estoqueCentral = [],
}: EquipamentosFormProps) {
  const tiposDisponiveis = filterEquipamentoTiposPorNicho(
    EQUIPAMENTO_TIPOS.filter((t) => t.enabled && EQUIPAMENTO_TIPOS_MAQUINA.includes(t.id)),
    nichosAtivos
  );
  const tipoUnico =
    tiposDisponiveis.length === 1 ? (tiposDisponiveis[0].id as EquipamentoTipo) : null;

  // Nicho já definido pelo painel do ponto — preenche o tipo sem pedir de novo.
  useEffect(() => {
    if (!tipoUnico) return;
    const precisaFixar = equipamentos.some((eq) => eq.tipo !== tipoUnico);
    if (!precisaFixar) return;
    onChange(equipamentos.map((eq) => (eq.tipo === tipoUnico ? eq : { ...eq, tipo: tipoUnico })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao tipo único disponível
  }, [tipoUnico]);

  function update(id: string, field: keyof EquipamentoInput, value: string) {
    onChange(
      equipamentos.map((eq) => {
        if (eq.id !== id) return eq;
        const next = { ...eq, [field]: value };
        if (field === "tipo") {
          next.numero_entrada = "";
          next.numero_saida = "";
          next.entrada_atual = "";
          next.preco_jogada = "";
          next.alocacaoBrinde = { modo: "nenhum" };
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

  function updateFoto(id: string, file: File | null) {
    onChange(
      equipamentos.map((eq) => {
        if (eq.id !== id) return eq;
        if (eq.fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(eq.fotoPreview);
        return {
          ...eq,
          fotoFile: file,
          fotoPreview: file ? URL.createObjectURL(file) : null,
        };
      })
    );
  }

  function updateAlocacao(id: string, alocacao: AlocacaoBrindeCadastro) {
    onChange(
      equipamentos.map((eq) => (eq.id === id ? { ...eq, alocacaoBrinde: alocacao } : eq))
    );
  }

  function addEquipamento() {
    onChange([...equipamentos, emptyEquipamento(tipoUnico ?? "")]);
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
              Cadastre cassino, ursinho, bolinha, vending ou fura-fura
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
          {equipamentos.map((eq, index) => {
            const tipoEfetivo = (eq.tipo || tipoUnico || "") as EquipamentoTipo | "";
            const tipoInfo = tipoEfetivo
              ? EQUIPAMENTO_TIPOS.find((t) => t.id === tipoEfetivo)
              : undefined;
            const isBolinha = tipoEfetivo === "bolinha";
            const nichoJaDefinido = Boolean(tipoUnico && tipoInfo);

            return (
              <div
                key={eq.id}
                className="glass-card space-y-4 rounded-xl border border-blue-500/10 p-4"
              >
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

                {nichoJaDefinido ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-primary-neon">
                      {tipoIcons[tipoUnico!]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{tipoInfo!.label}</p>
                      <p className="text-[11px] leading-snug text-slate-400">
                        {tipoInfo!.description}
                      </p>
                    </div>
                  </div>
                ) : (
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
                          selected={eq.tipo === tipo.id}
                          onClick={() => update(eq.id, "tipo", tipo.id)}
                          icon={tipoIcons[tipo.id as EquipamentoTipo]}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {tipoEfetivo && (
                  <>
                    {isBolinha && (
                      <FotoEquipamento
                        preview={eq.fotoPreview ?? null}
                        onChange={(file) => updateFoto(eq.id, file)}
                      />
                    )}

                    <EquipamentoIdentificacaoFields
                      key={`${eq.id}-${tipoEfetivo}`}
                      exigeSerie={Boolean(tipoEfetivo)}
                      serieOpcional={false}
                      numeroSerie={eq.numero_serie}
                      numeroMaquina={eq.numero_maquina}
                      onSerieChange={(v) => update(eq.id, "numero_serie", v)}
                      onNumeroChange={(v) => update(eq.id, "numero_maquina", v)}
                      pontoId={pontoId}
                      onHistoricoSugestao={
                        tipoEfetivo === "cassino" ||
                        tipoEfetivo === "ursinho" ||
                        tipoEfetivo === "bolinha"
                          ? (dados) => {
                              onChange(
                                equipamentos.map((item) =>
                                  item.id === eq.id
                                    ? {
                                        ...item,
                                        tipo: tipoEfetivo,
                                        nome: dados.nome || item.nome,
                                        numero_entrada:
                                          dados.numero_entrada || item.numero_entrada,
                                        numero_saida:
                                          dados.numero_saida || item.numero_saida,
                                        entrada_atual:
                                          dados.numero_entrada || item.entrada_atual,
                                        fotoPreview: dados.foto_url ?? item.fotoPreview,
                                      }
                                    : item
                                )
                              );
                            }
                          : undefined
                      }
                    />

                    <FormInput
                      label="Nome *"
                      placeholder={
                        isBolinha
                          ? "Ex: Bolinha entrada, Cápsula R$2"
                          : "Ex: Slot principal, Máquina da esquina"
                      }
                      value={eq.nome}
                      onChange={(e) => update(eq.id, "nome", e.target.value)}
                    />

                    {tipoEfetivo === "cassino" && (
                      <>
                        <p className="text-xs text-slate-500">
                          Leitura atual do painel. Na próxima coleta, esses valores viram
                          entrada/saída anterior.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormInput
                            label="Entrada atual *"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={eq.numero_entrada}
                            onChange={(e) =>
                              updateContador(eq.id, "numero_entrada", e.target.value)
                            }
                          />
                          <FormInput
                            label="Saída atual *"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={eq.numero_saida}
                            onChange={(e) =>
                              updateContador(eq.id, "numero_saida", e.target.value)
                            }
                          />
                        </div>
                      </>
                    )}

                    {tipoEfetivo === "bolinha" && (
                      <FormInput
                        label="Valor da jogada (R$) *"
                        inputMode="decimal"
                        placeholder="2,00"
                        value={eq.preco_jogada}
                        onChange={(e) => update(eq.id, "preco_jogada", e.target.value)}
                        hint="Ex.: jogada R$ 3 → com R$ 30 contados, saem 10 cápsulas"
                      />
                    )}

                    {((isEquipamentoTipoComBrindes(tipoEfetivo) &&
                      tipoEfetivo !== "bolinha" &&
                      tipoEfetivo !== "consignado") ||
                      isEquipamentoTipoDiversao(tipoEfetivo)) && (
                      <FormInput
                        label="Entrada atual (visor) *"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={eq.entrada_atual}
                        onChange={(e) =>
                          updateContador(eq.id, "entrada_atual", e.target.value)
                        }
                        hint="Leitura atual — na coleta vira valor anterior"
                      />
                    )}

                    {tipoEfetivo === "fura_fura" && (
                      <p className="text-xs text-slate-500">
                        A coleta registra furos feitos no ponto. Não é necessário informar
                        leitura de painel.
                      </p>
                    )}

                    {tipoEfetivo === "consignado" && (
                      <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3 text-xs text-amber-200/90">
                        Consignado não usa contador de entrada — só itens vendidos no recolhe.
                        Depois de criar, toque no expositor e use a aba{" "}
                        <span className="font-medium">Produtos</span> para alocar o estoque.
                      </div>
                    )}

                    {isEquipamentoTipoComBrindes(tipoEfetivo) &&
                      tipoEfetivo !== "consignado" && (
                        <AlocarBrindeCadastroEquipamento
                          value={eq.alocacaoBrinde}
                          onChange={(alocacao) => updateAlocacao(eq.id, alocacao)}
                          estoqueBrindesPonto={estoqueBrindesPonto}
                          estoqueCentral={estoqueCentral}
                          estoquePorMaquina={tipoEfetivo === "bolinha"}
                        />
                      )}

                    <FormTextarea
                      label="Observação"
                      value={eq.observacao}
                      onChange={(e) => update(eq.id, "observacao", e.target.value)}
                    />

                    {!isBolinha &&
                      (tipoEfetivo === "cassino" ||
                        tipoEfetivo === "fura_fura" ||
                        isEquipamentoTipoComBrindes(tipoEfetivo) ||
                        isEquipamentoTipoDiversao(tipoEfetivo)) && (
                        <FotoEquipamento
                          preview={eq.fotoPreview ?? null}
                          onChange={(file) => updateFoto(eq.id, file)}
                        />
                      )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
