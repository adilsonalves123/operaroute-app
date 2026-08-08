import { cn } from "@/lib/utils";

export function ColetaNovaGrid({
  operacao,
  fechar,
  className,
}: {
  operacao: React.ReactNode;
  fechar: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-6 lg:gap-7 xl:grid-cols-[minmax(0,1fr)_min(100%,380px)] xl:items-start",
        className
      )}
    >
      <div className="min-w-0 space-y-5">{operacao}</div>
      <div className="min-w-0">{fechar}</div>
    </div>
  );
}
