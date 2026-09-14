"use client";

import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Wallet } from "lucide-react";

export type VisitaColetaModoFechar = "continuar" | "receber" | "finalizar";

export function VisitaColetaModoPagamento({
  value,
  onChange,
  accent = "cyan",
  /**
   * - receber: Continuar | Receber (positivo)
   * - finalizar: Continuar | Finalizar (ex.: cassino negativo)
   * - ambos: Continuar | Receber | Finalizar (fura e demais nichos)
   */
  varianteSegundo = "receber",
}: {
  value: VisitaColetaModoFechar;
  onChange: (value: VisitaColetaModoFechar) => void;
  accent?: "cyan" | "pink" | "amber" | "emerald" | "rose";
  varianteSegundo?: "receber" | "finalizar" | "ambos";
}) {
  const selected =
    accent === "pink"
      ? "border-pink-500/45 bg-pink-500/[0.12] text-pink-50 ring-1 ring-pink-500/20"
      : accent === "amber"
        ? "border-amber-500/45 bg-amber-500/[0.12] text-amber-50 ring-1 ring-amber-500/20"
        : accent === "emerald"
          ? "border-emerald-500/45 bg-emerald-500/[0.12] text-emerald-50 ring-1 ring-emerald-500/20"
          : accent === "rose"
            ? "border-rose-500/45 bg-rose-500/[0.12] text-rose-50 ring-1 ring-rose-500/20"
            : "border-cyan-500/45 bg-cyan-500/[0.12] text-cyan-50 ring-1 ring-cyan-500/20";

  const mostrarReceber = varianteSegundo === "receber" || varianteSegundo === "ambos";
  const mostrarFinalizar = varianteSegundo === "finalizar" || varianteSegundo === "ambos";
  const tresOpcoes = mostrarReceber && mostrarFinalizar;

  function btnClass(ativo: boolean) {
    return cn(
      "rounded-xl border px-3 py-3 text-left transition",
      ativo ? selected : "border-at-soft bg-black/20 text-at-primary/85 hover:border-at-soft"
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-at-muted">
        Depois desta coleta
      </p>
      <div className={cn("grid gap-2.5", tresOpcoes ? "grid-cols-3" : "grid-cols-2")}>
        <button
          type="button"
          onClick={() => onChange("continuar")}
          className={btnClass(value === "continuar")}
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            Salvar e seguir
          </span>
          <span className="mt-1.5 block text-[11px] leading-snug text-at-muted">
            Não cobra agora · outros nichos · paga no Cobrar
          </span>
        </button>

        {mostrarReceber ? (
          <button
            type="button"
            onClick={() => onChange("receber")}
            className={btnClass(value === "receber")}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              Receber agora
            </span>
            <span className="mt-1.5 block text-[11px] leading-snug text-at-muted">
              Pix/dinheiro deste nicho · depois escolhe se encerra ou segue
            </span>
          </button>
        ) : null}

        {mostrarFinalizar ? (
          <button
            type="button"
            onClick={() => onChange("finalizar")}
            className={btnClass(value === "finalizar")}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Finalizar
            </span>
            <span className="mt-1.5 block text-[11px] leading-snug text-at-muted">
              Encerra sem cobrar agora
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
