import { cn } from "@/lib/utils";

export function coletaInputClass(hasError = false) {
  return cn(
    "w-full rounded-lg border bg-at-card px-3 py-2.5 text-sm text-at-primary outline-none transition placeholder:text-at-muted",
    hasError
      ? "border-red-500 focus:border-red-500"
      : "border-at focus:border-[var(--at-tab-active-border)]"
  );
}

export function coletaFieldClass() {
  return cn(
    "w-full rounded-lg border border-at bg-at-card px-3 py-2 text-sm text-at-primary outline-none transition placeholder:text-at-muted",
    "focus:border-[var(--at-tab-active-border)]"
  );
}

/** CTA principal — pill escuro no claro, dourado suave no escuro. */
export function coletaBtnPrimaryClass(extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-sm border border-at bg-at-tab-active px-5 py-2.5 text-sm font-semibold text-[var(--at-tab-active-text)] transition hover:brightness-110 disabled:opacity-50",
    extra
  );
}

/** Botão secundário (Imprimir, voltar, etc.). */
export function coletaBtnSecondaryClass(extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg border border-at bg-at-card px-4 py-2 text-sm font-medium text-at-primary transition hover:bg-at-card-soft disabled:opacity-50",
    extra
  );
}

/** Outline dourado — Compartilhar, ações leves. */
export function coletaBtnOutlineClass(extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg border border-at bg-at-card-soft px-4 py-2 text-sm font-medium text-at-link transition hover:border-[var(--at-tab-active-border)] hover:bg-at-tab-active/10 disabled:opacity-50",
    extra
  );
}

export function coletaCobrarBoxClass(extra?: string) {
  return cn("rounded-xl border border-at bg-at-card-soft p-3 space-y-2", extra);
}
