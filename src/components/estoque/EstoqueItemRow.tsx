"use client";

import { memo, type ReactNode, type Ref } from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  Cpu,
  ImageIcon,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { AlertBadge } from "@/components/ui/AlertBadge";
import { LazyThumb } from "@/components/ui/LazyThumb";
import { isCategoriaPecas, labelCategoriaEstoque } from "@/lib/estoque/categorias";
import type { EstoqueItem } from "@/lib/types/database";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  item: EstoqueItem;
  isEditing: boolean;
  adjustingItemId: string | null;
  rowRef?: Ref<HTMLDivElement>;
  onOpenEdit: (item: EstoqueItem) => void;
  onAdjustQty: (itemId: string, delta: number) => void;
  onTransfer: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  editPanel: ReactNode;
};

export const EstoqueItemRow = memo(function EstoqueItemRow({
  item,
  isEditing,
  adjustingItemId,
  rowRef,
  onOpenEdit,
  onAdjustQty,
  onTransfer,
  onDelete,
  editPanel,
}: Props) {
  const baixo =
    Number(item.quantidade_minima) > 0 &&
    Number(item.quantidade) <= Number(item.quantidade_minima);
  const ehPeca = isCategoriaPecas(item.categoria);

  return (
    <div
      ref={rowRef}
      className={cn(
        "overflow-hidden border border-at bg-white/[0.02]",
        isEditing &&
          "border-[#c4a574]/30 bg-at-card-soft ring-1 ring-[#c4a574]/15 lg:col-span-2"
      )}
    >
      <div className="flex w-full items-center gap-2 p-4 sm:gap-3">
        <button
          type="button"
          onClick={() => onOpenEdit(item)}
          aria-expanded={isEditing}
          className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
        >
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-at-soft">
            {item.foto_url ? (
              <LazyThumb
                src={item.foto_url}
                alt={item.nome_item}
                className="h-14 w-14"
                size={112}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-900/50 text-at-soft">
                {ehPeca ? <Cpu className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-at-primary">{item.nome_item}</p>
              {baixo ? <AlertBadge variant="warning">Estoque baixo</AlertBadge> : null}
            </div>
            {item.descricao?.trim() ? (
              <p className="mt-0.5 truncate text-sm text-at-primary/85">{item.descricao}</p>
            ) : null}
            <p className="mt-1 text-xs text-at-muted">
              {labelCategoriaEstoque(item.categoria)} ·{" "}
              {formatCurrency(Number(item.custo_unitario))}/un
              {item.quantidade_minima > 0 && ` · mín. ${item.quantidade_minima}`}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={adjustingItemId === item.id || Number(item.quantidade) <= 0}
            onClick={() => onAdjustQty(item.id, -1)}
            aria-label={`Diminuir ${item.nome_item}`}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-at-soft text-at-primary/85 hover:bg-at-card-soft disabled:pointer-events-none disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="min-w-[3.25rem] px-1 text-center">
            <p className="text-lg font-semibold tabular-nums text-at-primary">{item.quantidade}</p>
            <p className="text-[10px] leading-3 text-at-muted">un.</p>
          </div>
          <button
            type="button"
            disabled={adjustingItemId === item.id}
            onClick={() => onAdjustQty(item.id, 1)}
            aria-label={`Aumentar ${item.nome_item}`}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-[#c4a574]/40 bg-[#c4a574]/10 text-at-link hover:bg-[#c4a574]/20 disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpenEdit(item)}
          aria-expanded={isEditing}
          aria-label={isEditing ? "Fechar edição" : "Editar item"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-at-muted hover:bg-at-card-soft hover:text-at-link"
        >
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform",
              isEditing && "rotate-180 text-at-link"
            )}
          />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-3 border-t border-at px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {!ehPeca ? (
              <button
                type="button"
                onClick={() => onTransfer(item.id)}
                className="inline-flex items-center gap-1 rounded-sm border border-amber-500/30 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Alocar ponto
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="inline-flex items-center gap-1 rounded-sm border border-rose-500/25 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          </div>
          {editPanel}
        </div>
      ) : null}
    </div>
  );
});
