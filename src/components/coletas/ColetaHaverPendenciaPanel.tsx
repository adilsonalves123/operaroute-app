"use client";

import type { ReactNode } from "react";
import { Clock, HandCoins } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

/** Faixa de status financeiro — cor sólida polida (sem neon). */
export function ColetaStatusFaixa({
  tom,
  titulo,
  valor,
  descricao,
  icon,
  children,
  className,
}: {
  /** laranja = pendência · azul = haver crédito · roxo = haver de negativo · vermelho = alerta forte */
  tom: "pendencia" | "haver" | "negativo" | "alerta";
  titulo: string;
  valor: string;
  descricao?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const paleta =
    tom === "pendencia"
      ? {
          shell: "from-orange-500 to-orange-600 shadow-orange-950/40",
          valor: "bg-orange-800/55",
        }
      : tom === "haver"
        ? {
            shell: "from-blue-500 to-blue-700 shadow-blue-950/40",
            valor: "bg-blue-900/50",
          }
        : tom === "negativo"
          ? {
              shell: "from-violet-500 to-violet-800 shadow-violet-950/40",
              valor: "bg-violet-950/45",
            }
          : {
              shell: "from-red-500 to-red-700 shadow-red-950/40",
              valor: "bg-red-900/55",
            };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-br px-3.5 py-3.5 text-white shadow-md",
        paleta.shell,
        className
      )}
      role="status"
    >
      {/* brilho suave no canto — profundidade, sem glow neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-4 h-20 w-28 rounded-full bg-black/10"
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white ring-1 ring-inset ring-white/25">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 pt-0.5">
            <p className="text-[13px] font-semibold leading-snug tracking-tight text-white">
              {titulo}
            </p>
            {descricao ? (
              <p className="mt-1 text-[12px] leading-relaxed text-white/80">{descricao}</p>
            ) : null}
          </div>
        </div>
        <p
          className={cn(
            "shrink-0 rounded-lg px-2.5 py-1.5 text-[16px] font-bold tabular-nums tracking-tight text-white",
            paleta.valor
          )}
        >
          {valor}
        </p>
      </div>

      {children ? <div className="relative mt-3 border-t border-at pt-2.5">{children}</div> : null}
    </div>
  );
}

type Props = {
  haverSaldo: number;
  pendenciaSaldo: number;
  pendenciaColetas?: number;
  descontarHaver: boolean;
  onDescontarHaverChange: (v: boolean) => void;
  incluirPendencia: boolean;
  onIncluirPendenciaChange: (v: boolean) => void;
  /**
   * alertas — banners no topo (como cassino)
   * opcoes — checkboxes no painel de pagamento (como cassino)
   * tudo — ambos (legado)
   */
  variante?: "alertas" | "opcoes" | "tudo";
  /** @deprecated use variante="opcoes" | "tudo" */
  mostrarOpcoesCobranca?: boolean;
  className?: string;
};

/**
 * Avisos de haver / pendência — visual padrão (ledger), sem neon.
 */
export function ColetaHaverPendenciaPanel({
  haverSaldo,
  pendenciaSaldo,
  pendenciaColetas = 0,
  descontarHaver,
  onDescontarHaverChange,
  incluirPendencia,
  onIncluirPendenciaChange,
  variante,
  mostrarOpcoesCobranca = false,
  className,
}: Props) {
  const mode = variante ?? (mostrarOpcoesCobranca ? "tudo" : "alertas");
  const showAlertas = mode === "alertas" || mode === "tudo";
  const showOpcoes = mode === "opcoes" || mode === "tudo";

  const temHaver = haverSaldo > 0.009;
  const temPendencia = pendenciaSaldo > 0.009;
  if (!temHaver && !temPendencia) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {showAlertas && temHaver && (
        <ColetaStatusFaixa
          tom="haver"
          titulo="Haver do ponto"
          valor={formatCurrency(haverSaldo)}
          icon={<HandCoins className="h-4 w-4" />}
          descricao="Crédito em aberto — pode abater nesta cobrança."
        />
      )}

      {showAlertas && temPendencia && (
        <ColetaStatusFaixa
          tom="pendencia"
          titulo="Pendência do ponto"
          valor={formatCurrency(pendenciaSaldo)}
          icon={<Clock className="h-4 w-4" />}
          descricao={
            pendenciaColetas > 0
              ? `${pendenciaColetas} em aberto — inclui na cobrança ao receber`
              : "Dívida em aberto — inclui na cobrança ao receber"
          }
        />
      )}

      {showOpcoes && temHaver && (
        <label
          className={cn(
            "flex cursor-pointer gap-3 border px-3.5 py-3 transition-colors",
            descontarHaver
              ? "border-[#c4a574]/35 bg-[#c4a574]/[0.06]"
              : "border-at-soft bg-transparent hover:border-at-soft"
          )}
        >
          <input
            type="checkbox"
            checked={descontarHaver}
            onChange={(e) => onDescontarHaverChange(e.target.checked)}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 text-sm text-at-primary/90">
                <HandCoins className="h-3.5 w-3.5 shrink-0 text-at-muted" />
                Descontar haver nesta cobrança?
              </span>
              <span className="text-sm tabular-nums text-at-primary/85">
                {formatCurrency(haverSaldo)}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-at-muted">
              Se marcar, o cliente paga menos esse crédito.
            </p>
          </div>
        </label>
      )}

      {showOpcoes && temPendencia && (
        <label
          className={cn(
            "flex cursor-pointer gap-3 border px-3.5 py-3 transition-colors",
            incluirPendencia
              ? "border-amber-600/40 bg-amber-950/20"
              : "border-at-soft bg-transparent hover:border-at-soft"
          )}
        >
          <input
            type="checkbox"
            checked={incluirPendencia}
            onChange={(e) => onIncluirPendenciaChange(e.target.checked)}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 text-sm text-at-primary/90">
                <Clock className="h-3.5 w-3.5 shrink-0 text-at-muted" />
                Incluir pendência nesta cobrança
              </span>
              <span className="text-sm tabular-nums text-at-primary/85">
                {formatCurrency(pendenciaSaldo)}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-at-muted">
              Soma ao total a cobrar agora. Se não marcar, o excedente ainda pode abater a
              pendência.
            </p>
          </div>
        </label>
      )}
    </div>
  );
}

/** Só checkboxes — use no painel direito (ordem cassino: haver → total → pendência). */
export function ColetaOpcoesCobrancaHaver({
  haverSaldo,
  descontarHaver,
  onDescontarHaverChange,
  className,
}: {
  haverSaldo: number;
  descontarHaver: boolean;
  onDescontarHaverChange: (v: boolean) => void;
  className?: string;
}) {
  if (haverSaldo <= 0.009) return null;
  return (
    <ColetaHaverPendenciaPanel
      haverSaldo={haverSaldo}
      pendenciaSaldo={0}
      descontarHaver={descontarHaver}
      onDescontarHaverChange={onDescontarHaverChange}
      incluirPendencia={false}
      onIncluirPendenciaChange={() => {}}
      variante="opcoes"
      className={className}
    />
  );
}

export function ColetaOpcoesCobrancaPendencia({
  pendenciaSaldo,
  incluirPendencia,
  onIncluirPendenciaChange,
  className,
}: {
  pendenciaSaldo: number;
  incluirPendencia: boolean;
  onIncluirPendenciaChange: (v: boolean) => void;
  className?: string;
}) {
  if (pendenciaSaldo <= 0.009) return null;
  return (
    <ColetaHaverPendenciaPanel
      haverSaldo={0}
      pendenciaSaldo={pendenciaSaldo}
      descontarHaver={false}
      onDescontarHaverChange={() => {}}
      incluirPendencia={incluirPendencia}
      onIncluirPendenciaChange={onIncluirPendenciaChange}
      variante="opcoes"
      className={className}
    />
  );
}
