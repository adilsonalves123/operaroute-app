"use client";

import type { ReactNode } from "react";
import { Package, PackageOpen } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import { cn, formatCurrency } from "@/lib/utils";

export type KitComposicaoVisual = {
  nome: string;
  quantidade: number;
  custo_unitario?: number;
  foto_url?: string | null;
};

type Props = {
  nomeKit: string;
  noDeposito: number;
  itens?: KitComposicaoVisual[];
  /** Foto do kit (capa). */
  fotoUrl?: string | null;
  descricao?: string | null;
  /** Botões Editar / Desativar / Excluir — página de kits. */
  actions?: ReactNode;
  className?: string;
};

function ItemFoto({ item }: { item: KitComposicaoVisual }) {
  return (
    <div className="relative w-[5.5rem] shrink-0 space-y-1.5">
      {item.foto_url ? (
        <ExpandableImage
          src={item.foto_url}
          alt={item.nome}
          fullWidth={false}
          className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/10"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-900/80 ring-1 ring-white/10 text-slate-600">
          <Package className="h-5 w-5" />
        </div>
      )}
      {item.quantidade > 1 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-bold text-slate-950">
          ×{item.quantidade}
        </span>
      )}
      <p className="line-clamp-2 text-center text-[11px] leading-tight text-slate-300">
        {item.nome}
      </p>
      {item.custo_unitario != null && item.custo_unitario > 0 && (
        <p className="text-center text-[10px] text-slate-600">
          {formatCurrency(item.custo_unitario)}
        </p>
      )}
    </div>
  );
}

/** Cartão único do kit: status no depósito + composição (+ ações opcionais). */
export function KitDepositoControles({
  nomeKit,
  noDeposito,
  itens = [],
  fotoUrl,
  descricao,
  actions,
  className,
}: Props) {
  const showCapa = Boolean(fotoUrl || actions);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.07]",
        "bg-[radial-gradient(ellipse_at_top_left,_rgba(0,212,255,0.10),_transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.55))]",
        className
      )}
    >
      <div className="space-y-4 p-4 sm:p-5">
        {showCapa && (
          <div className="flex flex-wrap items-start gap-3">
            {fotoUrl ? (
              <ExpandableImage
                src={fotoUrl}
                alt={nomeKit}
                fullWidth={false}
                className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10 sm:h-20 sm:w-20"
              />
            ) : actions ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-900/80 ring-1 ring-white/10 text-slate-600 sm:h-20 sm:w-20">
                <Package className="h-7 w-7" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white sm:text-xl">{nomeKit}</h3>
                  {descricao ? (
                    <p className="mt-0.5 text-sm text-slate-500">{descricao}</p>
                  ) : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-1">{actions}</div> : null}
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">
            Pronto no depósito
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-white">
            {noDeposito}
            <span className="ml-2 text-base font-medium text-slate-400">
              kit{noDeposito === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {!showCapa && <span className="text-slate-200">{nomeKit}</span>}
            {!showCapa && " · "}
            {noDeposito > 0
              ? "Já pode alocar no ponto"
              : "Edite e salve para colocar itens no kit"}
          </p>
        </div>

        {itens.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Itens neste kit
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {itens.map((item, i) => (
                <ItemFoto key={`${item.nome}-${i}`} item={item} />
              ))}
            </div>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <PackageOpen className="h-3.5 w-3.5 shrink-0" />
          Ao salvar o kit, as unidades saem do estoque. Errar item? Tire com a lixeira e salve de
          novo — volta ao central.
        </p>
      </div>
    </div>
  );
}
