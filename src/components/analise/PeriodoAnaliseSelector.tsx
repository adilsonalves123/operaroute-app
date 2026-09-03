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
  /** Alinha pills com tema dourado das telas premium. */
  tema?: "premium" | "claro" | "default";
};

function pillActive(tema: Props["tema"]) {
  if (tema === "premium" || tema === "claro") {
    return "analise-tab-active border";
  }
  return "bg-primary-neon/20 text-primary-neon border-primary-neon/40";
}

function pillIdle(tema: Props["tema"]) {
  if (tema === "premium" || tema === "claro") {
    return "analise-tab-idle border";
  }
  return "text-at-muted border-slate-700 hover:border-slate-500 hover:text-at-primary/90";
}

export function PeriodoAnaliseSelector({
  atual,
  basePath = "/analise",
  variante = "analise",
  tema = "default",
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

  const usaPremiumDesk = tema === "premium" || tema === "claro";

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
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              atual.preset === op.id ? pillActive(tema) : pillIdle(tema)
            )}
          >
            {op.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
            atual.preset === "personalizado" || showCustom ? pillActive(tema) : pillIdle(tema)
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {variante === "dashboard" ? "Dia determinado" : "Data específica"}
        </button>
      </div>

      {(showCustom || atual.preset === "personalizado") && (
        <div
          className={cn(
            "flex flex-wrap items-end gap-3 rounded-xl border p-3",
            usaPremiumDesk ? "border-at bg-at-card-soft" : "border-at bg-white/[0.02]"
          )}
        >
          <div>
            <label className={cn("text-xs", usaPremiumDesk ? "text-at-muted" : "text-at-muted")}>
              {variante === "dashboard" ? "Dia" : "De"}
            </label>
            <input
              type="date"
              value={de}
              onChange={(e) => {
                setDe(e.target.value);
                if (variante === "dashboard" && !ate) setAte(e.target.value);
              }}
              className={cn(
                "mt-1 block rounded-lg border px-3 py-2 text-sm",
                usaPremiumDesk
                  ? "border-at bg-at-card text-at-primary"
                  : "border-slate-700 bg-slate-900 text-white"
              )}
            />
          </div>
          <div>
            <label className={cn("text-xs", usaPremiumDesk ? "text-at-muted" : "text-at-muted")}>
              {variante === "dashboard" ? "Até (opcional)" : "Até"}
            </label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className={cn(
                "mt-1 block rounded-lg border px-3 py-2 text-sm",
                usaPremiumDesk
                  ? "border-at bg-at-card text-at-primary"
                  : "border-slate-700 bg-slate-900 text-white"
              )}
            />
          </div>
          <button
            type="button"
            onClick={aplicarPersonalizado}
            disabled={!de || (Boolean(ate) && de > ate)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50",
              usaPremiumDesk
                ? "bg-[var(--at-tab-active-bg)] text-[var(--at-tab-active-text)]"
                : "bg-primary-neon text-slate-900"
            )}
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
