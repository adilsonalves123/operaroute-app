import { cn } from "@/lib/utils";

/** Banner quando a visita continua — pagamento só na aba Cobrar. */
export function ColetaContinuarPagamentoHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-primary-neon/25 bg-primary-neon/5 px-3 py-3 text-xs leading-relaxed text-slate-400",
        className
      )}
    >
      Continuando: pix, dinheiro, haver e dívida ficam para a aba{" "}
      <strong className="text-primary-neon">Cobrar</strong>, no final da visita. Aqui só o
      valor desta operação (e desconto, se houver).
    </div>
  );
}
