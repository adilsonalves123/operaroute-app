import { cn } from "@/lib/utils";

export function coletaInputClass(hasError = false) {
  return cn(
    "w-full rounded-lg border bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition",
    hasError
      ? "border-red-500 focus:border-red-500"
      : "border-slate-700 focus:border-[#c4a574]/70"
  );
}

export function coletaFieldClass() {
  return cn(
    "w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition",
    "focus:border-[#c4a574]/60"
  );
}
