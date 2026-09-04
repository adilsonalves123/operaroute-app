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

/** CTA principal — contorno sóbrio (sem bloco marrom/dourado pesado). */
export function coletaBtnPrimaryClass(extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg border border-[#1c1917]/18 bg-at-card px-5 py-2.5 text-sm font-semibold text-at-primary transition hover:border-[#1c1917]/30 hover:bg-at-card-soft disabled:opacity-50",
    extra
  );
}

/** Salvar / confirmar — um pouco mais de peso, ainda sem marrom sólido. */
export function coletaBtnSubmitClass(extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[#1c1917]/25 bg-[#1c1917] px-5 py-3.5 text-sm font-semibold text-[#faf8f4] transition hover:bg-[#292524] disabled:opacity-50",
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

/** Outline — Compartilhar, Cobrar leve, ações secundárias. */
export function coletaBtnOutlineClass(extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg border border-at bg-at-card px-4 py-2 text-sm font-medium text-at-primary transition hover:bg-at-card-soft disabled:opacity-50",
    extra
  );
}

export function coletaCobrarBoxClass(extra?: string) {
  return cn("rounded-xl border border-at bg-at-card-soft p-3 space-y-2", extra);
}
