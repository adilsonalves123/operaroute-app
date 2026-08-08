import { cn } from "@/lib/utils";

export function ColetaPontoBar({
  pontoField,
  comissaoField,
  alert,
  className,
}: {
  pontoField: React.ReactNode;
  comissaoField?: React.ReactNode;
  alert?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-card p-4 sm:p-5", className)}>
      <div
        className={cn(
          "grid gap-3",
          comissaoField ? "sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]" : "grid-cols-1"
        )}
      >
        {pontoField}
        {comissaoField}
      </div>
      {alert}
    </section>
  );
}
