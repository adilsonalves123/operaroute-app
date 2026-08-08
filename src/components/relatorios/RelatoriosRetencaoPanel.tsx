"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  RETENCAO_MIDIA_OPCOES,
  labelRetencaoMidia,
  type RetencaoMidiaDias,
} from "@/lib/relatorios/retencao";

type Props = {
  retencaoDias: RetencaoMidiaDias;
  podeGerir: boolean;
};

export function RelatoriosRetencaoPanel({ retencaoDias, podeGerir }: Props) {
  const router = useRouter();
  const [dias, setDias] = useState<RetencaoMidiaDias>(retencaoDias);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [msg, setMsg] = useState("");

  async function salvar(novo: RetencaoMidiaDias) {
    if (!podeGerir) return;
    setDias(novo);
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/relatorios/limpar-midia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retencao_midia_dias: novo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((data as { error?: string }).error ?? "Não foi possível salvar.");
        setDias(retencaoDias);
        return;
      }
      setMsg(`Retenção: ${labelRetencaoMidia(novo)}.`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function limparAgora() {
    if (!podeGerir) return;
    const alvo = dias === 0 ? 90 : dias;
    if (
      !confirm(
        dias === 0
          ? "Sua retenção está em «Nunca». Deseja limpar mesmo assim tudo com mais de 90 dias? Os números das coletas permanecem."
          : `Apagar agora fotos/relatórios com mais de ${alvo} dias? Os números das coletas permanecem.`
      )
    ) {
      return;
    }
    setCleaning(true);
    setMsg("");
    try {
      const res = await fetch("/api/relatorios/limpar-midia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          dias === 0 ? { forcar: true, forcar_dias: 90 } : { dias }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((data as { error?: string }).error ?? "Falha na limpeza.");
        return;
      }
      if ((data as { pulou?: boolean }).pulou) {
        setMsg((data as { message?: string }).message ?? "Nada a limpar.");
        return;
      }
      const r = data as {
        relatoriosRemovidos?: number;
        fotosColetaLimpas?: number;
      };
      setMsg(
        `Limpeza ok: ${r.relatoriosRemovidos ?? 0} relatório(s) e ${r.fotosColetaLimpas ?? 0} foto(s) de coleta.`
      );
      router.refresh();
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 px-4 py-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Guardar fotos e relatórios</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Padrão 90 dias. Você escolhe — ou apaga na mão quando quiser.
          </p>
        </div>
        {podeGerir && (
          <button
            type="button"
            disabled={cleaning || saving}
            onClick={() => void limparAgora()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {cleaning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Limpar agora
          </button>
        )}
      </div>

      {podeGerir ? (
        <div className="flex flex-wrap gap-1.5">
          {RETENCAO_MIDIA_OPCOES.map((op) => (
            <button
              key={op.value}
              type="button"
              disabled={saving}
              onClick={() => void salvar(op.value)}
              className={
                dias === op.value
                  ? "rounded-lg border border-primary-neon/50 bg-primary-neon/10 px-3 py-1.5 text-xs font-medium text-primary-neon"
                  : "rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
              }
            >
              {op.value === 0 ? "Nunca" : `${op.value} dias`}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          Retenção atual: <span className="text-slate-300">{labelRetencaoMidia(dias)}</span>
        </p>
      )}

      {msg && <p className="text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
