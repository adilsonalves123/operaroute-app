"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Loader2, X } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { EquipamentoIdentificacaoFields } from "@/components/pontos/EquipamentoIdentificacaoFields";
import { getEquipamentoTipoLabel, isEquipamentoTipoDiversao } from "@/lib/equipamentos";
import { formatContador, formatContadorInput } from "@/lib/nichos/cassino";
import type { Equipamento } from "@/lib/types/database";

function subtituloEdicao(tipo: Equipamento["tipo"]) {
  if (tipo === "bolinha") {
    return "Cadastre o valor da jogada. Na coleta você conta o dinheiro e o sistema calcula as cápsulas.";
  }
  if (tipo === "cassino" || tipo === "ursinho") {
    return "Série do painel rastreia o equipamento na operação. O nº no ponto é como você identifica a máquina neste local.";
  }
  if (tipo === "vending_ursinho") {
    return "Informe o nº no ponto e a entrada do visor. Este tipo legado não exige série.";
  }
  if (isEquipamentoTipoDiversao(tipo)) {
    return "Informe o nº no ponto e a entrada do visor. A série do painel é opcional para esse tipo.";
  }
  if (tipo === "consignado") {
    return "Expositor: identificação e nome. Não usa entrada — só itens vendidos no recolhe.";
  }
  return "Em fura-fura, use o nº no ponto e o nome da máquina.";
}

function contadorInicial(value: number | null) {
  return value != null ? formatContador(Math.round(Number(value))) : "";
}

export function EquipamentoEditarButton({ equipamento }: { equipamento: Equipamento }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome: equipamento.nome ?? "",
    numero_maquina: equipamento.numero_maquina ?? "",
    numero_serie: equipamento.numero_serie ?? "",
    numero_entrada: contadorInicial(equipamento.numero_entrada),
    numero_saida: contadorInicial(equipamento.numero_saida),
    entrada_atual: contadorInicial(equipamento.entrada_atual),
    preco_jogada:
      equipamento.preco_jogada != null ? String(equipamento.preco_jogada).replace(".", ",") : "",
    observacao: equipamento.observacao ?? "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      nome: equipamento.nome ?? "",
      numero_maquina: equipamento.numero_maquina ?? "",
      numero_serie: equipamento.numero_serie ?? "",
      numero_entrada: contadorInicial(equipamento.numero_entrada),
      numero_saida: contadorInicial(equipamento.numero_saida),
      entrada_atual: contadorInicial(equipamento.entrada_atual),
      preco_jogada:
        equipamento.preco_jogada != null ? String(equipamento.preco_jogada).replace(".", ",") : "",
      observacao: equipamento.observacao ?? "",
    });
    setError("");
    // Só ao abrir / trocar máquina — não a cada re-render do objeto equipamento
    // (isso derruba o teclado no tablet).
  }, [open, equipamento.id]);

  async function salvar() {
    setLoading(true);
    setError("");
    try {
      const body: Record<string, string | null> = {
        nome: form.nome,
        numero_maquina: form.numero_maquina,
        observacao: form.observacao,
      };

      if (
        equipamento.tipo === "cassino" ||
        equipamento.tipo === "ursinho" ||
        equipamento.tipo === "bolinha" ||
        isEquipamentoTipoDiversao(equipamento.tipo)
      ) {
        body.numero_serie = form.numero_serie;
      }

      if (equipamento.tipo === "cassino") {
        body.numero_entrada = form.numero_entrada;
        body.numero_saida = form.numero_saida;
      }

      if (equipamento.tipo === "bolinha") {
        body.preco_jogada = form.preco_jogada;
      } else if (
        equipamento.tipo === "ursinho" ||
        equipamento.tipo === "vending_ursinho" ||
        isEquipamentoTipoDiversao(equipamento.tipo)
      ) {
        body.entrada_atual = form.entrada_atual;
      }

      const res = await fetch(`/api/equipamentos/${equipamento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar equipamento.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const exigeSerie =
    equipamento.tipo === "cassino" ||
    equipamento.tipo === "ursinho" ||
    equipamento.tipo === "bolinha";
  const permiteSerieOpcional = isEquipamentoTipoDiversao(equipamento.tipo);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-slate-500 transition hover:bg-white/[0.04] hover:text-[#c4a574]"
        title="Editar equipamento"
      >
        <Edit3 className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`editar-equipamento-${equipamento.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`editar-equipamento-${equipamento.id}`} className="font-semibold text-white">
                  Editar máquina · {getEquipamentoTipoLabel(equipamento.tipo)}
                </h3>
                <p className="mt-1 text-sm text-slate-400">{subtituloEdicao(equipamento.tipo)}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <EquipamentoIdentificacaoFields
              key={equipamento.id}
              exigeSerie={exigeSerie}
              serieOpcional={permiteSerieOpcional}
              numeroSerie={form.numero_serie}
              numeroMaquina={form.numero_maquina}
              onSerieChange={(v) => setForm((prev) => ({ ...prev, numero_serie: v }))}
              onNumeroChange={(v) => setForm((prev) => ({ ...prev, numero_maquina: v }))}
            />

            <FormInput
              label="Nome *"
              value={form.nome}
              onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            />

            {equipamento.tipo === "cassino" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  label="Entrada atual"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={form.numero_entrada}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      numero_entrada: formatContadorInput(e.target.value),
                    }))
                  }
                />
                <FormInput
                  label="Saída atual"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={form.numero_saida}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      numero_saida: formatContadorInput(e.target.value),
                    }))
                  }
                />
              </div>
            )}

            {(equipamento.tipo === "ursinho" || equipamento.tipo === "vending_ursinho") && (
              <FormInput
                label="Entrada atual (visor)"
                inputMode="numeric"
                placeholder="0,00"
                value={form.entrada_atual}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    entrada_atual: formatContadorInput(e.target.value),
                  }))
                }
              />
            )}

            {equipamento.tipo === "bolinha" && (
              <FormInput
                label="Valor da jogada (R$) *"
                inputMode="decimal"
                placeholder="2,00"
                value={form.preco_jogada}
                onChange={(e) => setForm((prev) => ({ ...prev, preco_jogada: e.target.value }))}
                hint="Ex.: R$ 3 a jogada · R$ 30 contados = 10 cápsulas"
              />
            )}

            <FormTextarea
              label="Observação"
              value={form.observacao}
              onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingOverlay show={loading} message="Salvando equipamento..." />
    </>
  );
}
