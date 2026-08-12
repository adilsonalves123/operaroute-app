"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Edit3, Loader2, X } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { FotoEquipamento } from "@/components/pontos/FotoEquipamento";
import { EquipamentoIdentificacaoFields } from "@/components/pontos/EquipamentoIdentificacaoFields";
import { getEquipamentoTipoLabel, isEquipamentoTipoDiversao } from "@/lib/equipamentos";
import { salvarFotoEquipamento } from "@/lib/equipamentos/salvar-foto-equipamento";
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
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(equipamento.foto_url ?? null);
  const [fotoRemovida, setFotoRemovida] = useState(false);
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
    setMounted(true);
  }, []);

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
    setFotoFile(null);
    setFotoPreview(equipamento.foto_url ?? null);
    setFotoRemovida(false);
    setError("");
    // Só ao abrir / trocar máquina — não a cada re-render do objeto equipamento
    // (isso derruba o teclado no tablet).
  }, [open, equipamento.id]);

  useEffect(() => {
    return () => {
      if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  function handleFotoChange(file: File | null) {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    if (file) {
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
      setFotoRemovida(false);
      return;
    }
    setFotoFile(null);
    setFotoPreview(null);
    setFotoRemovida(true);
  }

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [open]);

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

      if (fotoRemovida && !fotoFile) {
        body.foto_url = null;
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

      if (fotoFile) {
        const foto = await salvarFotoEquipamento(equipamento.id, fotoFile);
        if (!foto.ok) {
          setError(foto.error);
          return;
        }
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

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-stretch justify-center bg-black/90 sm:items-center sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-[#070b14] shadow-2xl sm:h-auto sm:max-h-[min(90dvh,720px)] sm:rounded-2xl sm:border sm:border-slate-700 [&_input]:bg-slate-900 [&_textarea]:bg-slate-900"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`editar-equipamento-${equipamento.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
                <div className="min-w-0">
                  <h3
                    id={`editar-equipamento-${equipamento.id}`}
                    className="text-base font-semibold text-white sm:text-lg"
                  >
                    Editar máquina · {getEquipamentoTipoLabel(equipamento.tipo)}
                  </h3>
                  <p className="mt-1 hidden text-sm text-slate-400 sm:block">
                    {subtituloEdicao(equipamento.tipo)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5"
                style={{ touchAction: "pan-y" }}
              >
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

                <FotoEquipamento preview={fotoPreview} onChange={handleFotoChange} />

                {equipamento.tipo === "cassino" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, preco_jogada: e.target.value }))
                    }
                    hint="Ex.: R$ 3 a jogada · R$ 30 contados = 10 cápsulas"
                  />
                )}

                <FormTextarea
                  label="Observação"
                  value={form.observacao}
                  onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
                />

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>

              <div className="flex shrink-0 gap-2 border-t border-slate-800 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:justify-end sm:px-5 sm:pb-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="flex-1 rounded-lg px-4 py-3 text-sm text-slate-300 hover:text-white disabled:opacity-50 sm:flex-none sm:py-2"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvar}
                  disabled={loading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-neon px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50 sm:flex-none sm:py-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar alterações
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

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

      {modal}

      <LoadingOverlay show={loading} message="Salvando equipamento..." />
    </>
  );
}
