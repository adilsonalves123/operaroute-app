"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildAnaliseSearchParams,
  periodoAnaliseOpcoes,
  periodoDashboardOpcoes,
  type PeriodoAnalisePreset,
  type PeriodoAnaliseRange,
} from "@/lib/analise/periodo-analise";

type Props = {
  atual: PeriodoAnaliseRange;
  basePath?: string;
  /** Dashboard: Hoje / Semana / Mês. Análise: presets padrão. */
  variante?: "analise" | "dashboard";
};

export function PeriodoAnaliseSelector({
  atual,
  basePath = "/analise",
  variante = "analise",
}: Props) {
  const router = useRouter();
  const opcoes = variante === "dashboard" ? periodoDashboardOpcoes : periodoAnaliseOpcoes;
  const [de, setDe] = useState(
    atual.preset === "personalizado" ? atual.inicio.toISOString().slice(0, 10) : ""
  );
  const [ate, setAte] = useState(
    atual.preset === "personalizado" ? atual.fim.toISOString().slice(0, 10) : ""
  );
  const [showCustom, setShowCustom] = useState(atual.preset === "personalizado");

  function navegar(preset: PeriodoAnalisePreset, customDe?: string, customAte?: string) {
    const qs = buildAnaliseSearchParams(preset, customDe, customAte);
    router.push(`${basePath}?${qs}`);
  }

  function aplicarPersonalizado() {
    if (!de) return;
    const ateFinal = ate || de;
    if (de > ateFinal) return;
    navegar("personalizado", de, ateFinal);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {opcoes.map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => {
              setShowCustom(false);
              navegar(op.id);
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition border",
              atual.preset === op.id
                ? "bg-primary-neon/20 text-primary-neon border-primary-neon/40"
                : "text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
            )}
          >
            {op.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition border",
            atual.preset === "personalizado" || showCustom
              ? "bg-primary-neon/20 text-primary-neon border-primary-neon/40"
              : "text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {variante === "dashboard" ? "Dia determinado" : "Data específica"}
        </button>
      </div>

      {(showCustom || atual.preset === "personalizado") && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div>
            <label className="text-xs text-slate-500">
              {variante === "dashboard" ? "Dia" : "De"}
            </label>
            <input
              type="date"
              value={de}
              onChange={(e) => {
                setDe(e.target.value);
                if (variante === "dashboard" && !ate) setAte(e.target.value);
              }}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">
              {variante === "dashboard" ? "Até (opcional)" : "Até"}
            </label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="button"
            onClick={aplicarPersonalizado}
            disabled={!de || (Boolean(ate) && de > ate)}
            className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
