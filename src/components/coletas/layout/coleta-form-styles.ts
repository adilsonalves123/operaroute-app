import { cn } from "@/lib/utils";

export function coletaInputClass(hasError = false) {
  return cn(
    "w-full rounded-lg border bg-at-card px-3 py-2.5 text-sm text-at-primary outline-none transition placeholder:text-at-muted",
    hasError
      ? "border-red-500 focus:border-red-500"
      : "border-at focus:border-[#c4a574]/50"
  );
}

export function coletaFieldClass() {
  return cn(
    "w-full rounded-lg border border-at bg-at-card px-3 py-2 text-sm text-at-primary outline-none transition placeholder:text-at-muted",
    "focus:border-[#c4a574]/50"
  );
}
