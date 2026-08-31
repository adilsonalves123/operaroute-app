"use client";

import Link from "next/link";
import { memo } from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  ImageIcon,
  Package,
  Pencil,
} from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { LazyThumb } from "@/components/ui/LazyThumb";
import { KitDepositoControles } from "@/components/kits/KitDepositoControles";
import { cn, formatCurrency } from "@/lib/utils";

export type KitNoEstoqueCentral = {
  id: string;
  nome: string;
  foto_url?: string | null;
  ativo: boolean;
  quantidade_montada: number;
  reposicao_itens: {
    estoque_item_id?: string | null;
    nome: string;
    quantidade: number;
    custo_unitario: number;
    foto_url?: string | null;
  }[];
};

function custoTotalKit(kit: KitNoEstoqueCentral): number {
  return kit.reposicao_itens.reduce(
    (s, r) => s + Math.max(0, r.quantidade) * Number(r.custo_unitario ?? 0),
    0
  );
}

function itensPorKit(kit: KitNoEstoqueCentral): number {
  return kit.reposicao_itens.reduce((s, r) => s + Math.max(0, Math.floor(r.quantidade)), 0);
}

type Props = {
  kit: KitNoEstoqueCentral;
  estoqueQtds: { id: string; quantidade: number }[];
  expanded: boolean;
  onToggle: () => void;
  onAlocar: () => void;
  onMsg?: (text: string, isError?: boolean) => void;
};

export const EstoqueKitRow = memo(function EstoqueKitRow({
  kit,
  expanded,
  onToggle,
  onAlocar,
}: Props) {
  const custo = custoTotalKit(kit);
  const itens = itensPorKit(kit);
  const qty = kit.quantidade_montada ?? 0;

  const itensVisuais = kit.reposicao_itens.map((r) => ({
    nome: r.nome,
    quantidade: r.quantidade,
    custo_unitario: r.custo_unitario,
    foto_url: r.foto_url ?? null,
  }));

  return (
    <div
      className={cn(
        "glass-card overflow-hidden border transition",
        expanded
          ? "border-cyan-400/35 ring-1 ring-cyan-400/20"
          : "border-cyan-500/10 hover:border-cyan-500/25"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left sm:gap-4"
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-cyan-500/20 bg-cyan-500/5">
          {kit.foto_url ? (
            <LazyThumb
              src={kit.foto_url}
              alt={kit.nome}
              className="h-14 w-14"
              size={112}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-cyan-600">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-white">{kit.nome}</p>
            <AlertBadge variant="info">Kit</AlertBadge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            pronto no depósito · {formatCurrency(custo)}/kit
            {itens > 0 && ` · ${itens} itens`}
          </p>
          {!expanded && kit.reposicao_itens.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-hidden">
              {kit.reposicao_itens.slice(0, 5).map((r, i) =>
                r.foto_url ? (
                  <LazyThumb
                    key={`${r.nome}-${i}`}
                    src={r.foto_url}
                    alt={r.nome}
                    className="h-8 w-8 rounded-md ring-1 ring-white/10"
                    size={64}
                  />
                ) : (
                  <div
                    key={`${r.nome}-${i}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 ring-1 ring-white/10 text-slate-600"
                  >
                    <Package className="h-3 w-3" />
                  </div>
                )
              )}
            </div>
          )}
        </div>
        <p className="shrink-0 text-lg font-semibold tabular-nums text-white">
          {qty} <span className="text-sm font-normal text-slate-500">un.</span>
        </p>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-slate-500 transition-transform",
            expanded && "rotate-180 text-cyan-300"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3">
            <KitDepositoControles
              nomeKit={kit.nome}
              noDeposito={qty}
              itens={itensVisuais}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onAlocar}
                disabled={qty < 1}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 px-4 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Alocar no ponto
              </button>
              <Link
                href={`/estoque/kits?montar=${kit.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 px-4 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
              >
                <Package className="h-3.5 w-3.5" />
                Montar mais
              </Link>
              <Link
                href={`/estoque/kits?edit=${kit.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:bg-slate-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar kit
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export function custoKitFromReposicao(
  reposicao: { quantidade: number; custo_unitario: number }[]
): number {
  return reposicao.reduce(
    (s, r) => s + Math.max(0, r.quantidade) * Number(r.custo_unitario ?? 0),
    0
  );
}
