import { formatCurrency } from "@/lib/utils";
import type { ResumoRascunhoSnapshot } from "@/lib/rascunho/compartilhar";

function dataLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ResumoPublicView({ snap }: { snap: ResumoRascunhoSnapshot }) {
  const maxAbs = Math.max(...snap.pontos.map((p) => Math.abs(p.valor)), 1);

  return (
    <main className="min-h-screen bg-at-card px-4 py-10 text-at-primary">
      <div className="mx-auto max-w-lg space-y-8">
        <header className="space-y-2 border-b border-at-soft pb-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-at-link/90">
            OperaRoute · {snap.empresaNome}
          </p>
          <h1 className="text-3xl font-serif leading-tight">
            {snap.titulo || "Resumo"}
          </h1>
          <p className="capitalize text-sm text-at-muted">{dataLabel(snap.dataISO)}</p>
        </header>

        <section className="space-y-3 rounded-lg border border-at-soft bg-at-card-soft p-5">
          <div className="flex justify-between text-sm">
            <span className="text-at-muted">Recebido</span>
            <span className="tabular-nums">{formatCurrency(snap.recebido)}</span>
          </div>
          {snap.deixado > 0.009 ? (
            <div className="flex justify-between text-sm">
              <span className="text-at-muted">Deixado no ponto</span>
              <span className="tabular-nums text-rose-300">
                − {formatCurrency(snap.deixado)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-at-soft pt-3 text-base font-medium">
            <span>Total líquido</span>
            <span className="tabular-nums text-at-link">
              {formatCurrency(snap.totalLiquido)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 text-sm text-at-muted">
            <div>
              Pix
              <p className="text-lg tabular-nums text-at-primary">
                {formatCurrency(snap.pix)}
              </p>
            </div>
            <div>
              Dinheiro
              <p className="text-lg tabular-nums text-at-primary">
                {formatCurrency(snap.dinheiro)}
              </p>
            </div>
          </div>
        </section>

        {snap.pontos.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-at-muted">
              Por ponto
            </h2>
            <ol className="space-y-3">
              {snap.pontos.map((p, i) => {
                const width = Math.max(6, (Math.abs(p.valor) / maxAbs) * 100);
                return (
                  <li key={`${p.nome}-${i}`} className="space-y-1">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-at-primary/85">
                        {p.nome}
                        {p.forma ? (
                          <span className="ml-2 text-[10px] uppercase text-at-muted">
                            {p.forma}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={
                          p.valor < 0 ? "text-rose-300" : "tabular-nums text-at-primary"
                        }
                      >
                        {formatCurrency(p.valor)}
                      </span>
                    </div>
                    <div className="h-[3px] bg-white/5">
                      <div
                        className={`h-full ${p.valor < 0 ? "bg-rose-400/50" : "bg-[#c4a574]/70"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </div>
    </main>
  );
}
