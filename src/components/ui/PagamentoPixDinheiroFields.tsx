"use client";

import { FormInput } from "@/components/ui/FormInput";
import { formatCurrency } from "@/lib/utils";
import { formatMoneyInput, formatMoneyInputOnBlur, parseMoneyInput } from "@/lib/utils";

type Props = {
  pix: string;
  dinheiro: string;
  onPixChange: (value: string) => void;
  onDinheiroChange: (value: string) => void;
  pixLabel?: string;
  dinheiroLabel?: string;
  hint?: string;
};

export function PagamentoPixDinheiroFields({
  pix,
  dinheiro,
  onPixChange,
  onDinheiroChange,
  pixLabel = "Pix (R$)",
  dinheiroLabel = "Dinheiro (R$)",
  hint,
}: Props) {
  const total = parseMoneyInput(pix) + parseMoneyInput(dinheiro);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          label={pixLabel}
          inputMode="numeric"
          value={pix}
          onChange={(e) => onPixChange(formatMoneyInput(e.target.value))}
          onBlur={(e) => onPixChange(formatMoneyInputOnBlur(e.target.value))}
          placeholder="0,00"
        />
        <FormInput
          label={dinheiroLabel}
          inputMode="numeric"
          value={dinheiro}
          onChange={(e) => onDinheiroChange(formatMoneyInput(e.target.value))}
          onBlur={(e) => onDinheiroChange(formatMoneyInputOnBlur(e.target.value))}
          placeholder="0,00"
        />
      </div>
      {total > 0.009 && (
        <p className="text-xs text-slate-400">
          Total recebido: <span className="font-medium text-white">{formatCurrency(total)}</span>
        </p>
      )}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
