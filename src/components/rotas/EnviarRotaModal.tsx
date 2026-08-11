"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, User, X } from "lucide-react";
import { FormInput, FormSelect } from "@/components/ui/FormInput";
import type { OperadorRotaOpcao, RotaSalva } from "@/lib/rotas/rotas-salvas";
import { progressoRota } from "@/lib/rotas/rotas-salvas";
import {
  mensagemWhatsAppDeRotaSalva,
  whatsAppUrlRota,
} from "@/lib/rotas/whatsapp-rota";
import type { Coordenada, ParadaRota } from "@/lib/rotas/otimizar-rota";

type Props = {
  rota: RotaSalva;
  operadores: OperadorRotaOpcao[];
  pontosPorId: Map<string, { nome: string; endereco?: string | null; cidade?: string | null }>;
  /** Paradas com geo (opcional) para link do Maps */
  paradasGeo?: ParadaRota[] | null;
  inicio?: Coordenada | null;
  onClose: () => void;
  onAtribuido: (rota: RotaSalva) => void;
};

export function EnviarRotaModal({
  rota,
  operadores,
  pontosPorId,
  paradasGeo,
  inicio = null,
  onClose,
  onAtribuido,
}: Props) {
  const [operadorId, setOperadorId] = useState(rota.operador_id ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const prog = progressoRota(rota);
  const operador = operadores.find((o) => o.userId === operadorId);

  const operadorOptions = useMemo(
    () => [
      { value: "", label: "Selecione o ajudante *" },
      ...operadores.map((o) => ({
        value: o.userId,
        label: `${o.nome}${o.whatsapp ? "" : " · sem WhatsApp"}`,
      })),
    ],
    [operadores]
  );

  async function atribuirNoApp(): Promise<RotaSalva | null> {
    if (!operadorId) {
      setMsg("Escolha quem vai receber a rota.");
      return null;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/rotas/${rota.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador_id: operadorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((data as { error?: string }).error ?? "Não foi possível atribuir.");
        return null;
      }
      const atualizada: RotaSalva = {
        ...rota,
        operador_id: operadorId,
        operador_nome: operador?.nome ?? rota.operador_nome,
      };
      onAtribuido(atualizada);
      return atualizada;
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviarApp() {
    const ok = await atribuirNoApp();
    if (ok) onClose();
  }

  async function handleWhatsApp() {
    const atualizada = await atribuirNoApp();
    if (!atualizada) return;

    const { texto } = mensagemWhatsAppDeRotaSalva(
      atualizada,
      pontosPorId,
      inicio,
      paradasGeo ?? undefined
    );
    const url = whatsAppUrlRota(operador?.whatsapp, texto);
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enviar-rota-title"
    >
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c1220] shadow-2xl overflow-hidden">
        <div className="relative px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0,212,255,0.18), transparent 55%)",
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">Enviar rota</p>
              <h2 id="enviar-rota-title" className="text-xl font-semibold tracking-tight text-white mt-1">
                {rota.nome}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {rota.cidade ?? "—"} · {prog.total} paradas · progresso mantido ao reatribuir
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <FormSelect
            label="Ajudante / operador *"
            value={operadorId}
            onChange={(e) => {
              setOperadorId(e.target.value);
              setMsg("");
            }}
            options={operadorOptions}
          />

          {operador && (
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
              <User className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-300">{operador.nome}</span>
              <span>·</span>
              <span>{operador.whatsapp ? operador.whatsapp : "sem WhatsApp cadastrado"}</span>
            </div>
          )}

          <p className="text-xs text-slate-500 leading-relaxed">
            A rota aparece em <strong className="text-slate-400">Minha rota</strong> no app dele.
            WhatsApp é opcional, só o resumo das paradas.
          </p>

          {msg && (
            <p className="text-sm text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              {msg}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={loading || !operadorId}
              onClick={() => void handleEnviarApp()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-neon py-3 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Atribuir no app
            </button>
            <button
              type="button"
              disabled={loading || !operadorId}
              onClick={() => void handleWhatsApp()}
              className="inline-flex w-full items-center justify-center gap-1.5 py-2 text-sm text-slate-500 hover:text-emerald-300 disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Também avisar no WhatsApp
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 text-sm text-slate-500 hover:text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Formulário de envio no passo 3 do wizard (criar rota nova). */
export function EnviarRotaWizardFields({
  nome,
  onNomeChange,
  operadorId,
  onOperadorChange,
  operadores,
  cidade,
  totalParadas,
  msg,
}: {
  nome: string;
  onNomeChange: (v: string) => void;
  operadorId: string;
  onOperadorChange: (v: string) => void;
  operadores: OperadorRotaOpcao[];
  cidade: string;
  totalParadas: number;
  msg?: string;
}) {
  const operadorOptions = [
    { value: "", label: "Selecione o ajudante *" },
    ...operadores.map((o) => ({
      value: o.userId,
      label: `${o.nome}${o.whatsapp ? "" : " · sem WhatsApp"}`,
    })),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Salvar <strong className="text-white">{totalParadas}</strong> paradas em{" "}
        <strong className="text-cyan-300">{cidade || "—"}</strong> e atribuir no app.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormInput
          label="Nome da rota *"
          value={nome}
          onChange={(e) => onNomeChange(e.target.value)}
          placeholder="Ex.: Centro — segunda"
        />
        <FormSelect
          label="Ajudante *"
          value={operadorId}
          onChange={(e) => onOperadorChange(e.target.value)}
          options={operadorOptions}
        />
      </div>
      {msg && <p className="text-sm text-red-400">{msg}</p>}
    </div>
  );
}
