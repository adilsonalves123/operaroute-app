"use client";

import { FormInput } from "@/components/ui/FormInput";
import {
  valorForaCaixa,
  valorMovimentoCaixa,
  type MovimentoCaixaDetalhe,
} from "@/lib/nichos/cassino/caixa";
import { formatCurrency, cn } from "@/lib/utils";
import { formatMoneyInput, formatMoneyInputOnBlur, parseMoneyInput } from "@/lib/utils";

type PagamentoCaixaFieldsProps = {
  /** entrada = recebeu do cliente/ponto; saida = você pagou/adiantou */
  modo: "entrada" | "saida";
  pix: string;
  dinheiro: string;
  pixDoCaixa: boolean;
  dinheiroDoCaixa: boolean;
  onPixChange: (value: string) => void;
  onDinheiroChange: (value: string) => void;
  onPixDoCaixaChange: (checked: boolean) => void;
  onDinheiroDoCaixaChange: (checked: boolean) => void;
  pixLabel?: string;
  dinheiroLabel?: string;
};

function CaixaToggle({
  checked,
  onChange,
  modo,
  valorReais,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  modo: "entrada" | "saida";
  valorReais: number;
}) {
  if (valorReais <= 0.009) return null;

  const titulo = modo === "entrada" ? "Entrou no caixa?" : "Saiu do caixa?";
  const descricao =
    modo === "entrada"
      ? "Marcado = entra no financeiro. Desmarcado = registra na coleta, mas fica fora do caixa."
      : "Marcado = sai do financeiro. Desmarcado = registra o pagamento, mas fica fora do caixa.";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
        checked
          ? "border-primary-neon/50 bg-primary-neon/10"
          : "border-slate-700/60 bg-slate-900/40 hover:border-slate-600"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold",
            checked
              ? "border-primary-neon bg-primary-neon text-slate-950"
              : "border-slate-600 bg-slate-800 text-transparent"
          )}
        >
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{titulo}</p>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{descricao}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-300 shrink-0">
          {formatCurrency(valorReais)}
        </span>
      </div>
    </button>
  );
}

export function PagamentoCaixaFields({
  modo,
  pix,
  dinheiro,
  pixDoCaixa,
  dinheiroDoCaixa,
  onPixChange,
  onDinheiroChange,
  onPixDoCaixaChange,
  onDinheiroDoCaixaChange,
  pixLabel,
  dinheiroLabel,
}: PagamentoCaixaFieldsProps) {
  const pixReais = parseMoneyInput(pix);
  const dinheiroReais = parseMoneyInput(dinheiro);
  const entradaAutomaticaNoCaixa = modo === "entrada";
  const detalhe: MovimentoCaixaDetalhe = {
    pixReais,
    dinheiroReais,
    pixDoCaixa: entradaAutomaticaNoCaixa ? pixReais > 0.009 : pixDoCaixa,
    dinheiroDoCaixa: entradaAutomaticaNoCaixa ? dinheiroReais > 0.009 : dinheiroDoCaixa,
  };
  const totalInformado = pixReais + dinheiroReais;
  const movimentaCaixa = valorMovimentoCaixa(detalhe);
  const foraCaixa = valorForaCaixa(detalhe);

  function handlePixChange(raw: string) {
    const formatted = formatMoneyInput(raw);
    onPixChange(formatted);
    if (entradaAutomaticaNoCaixa) {
      onPixDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  function handlePixBlur(raw: string) {
    const formatted = formatMoneyInputOnBlur(raw);
    onPixChange(formatted);
    if (entradaAutomaticaNoCaixa) {
      onPixDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  function handleDinheiroChange(raw: string) {
    const formatted = formatMoneyInput(raw);
    onDinheiroChange(formatted);
    if (entradaAutomaticaNoCaixa) {
      onDinheiroDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  function handleDinheiroBlur(raw: string) {
    const formatted = formatMoneyInputOnBlur(raw);
    onDinheiroChange(formatted);
    if (entradaAutomaticaNoCaixa) {
      onDinheiroDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FormInput
            label={pixLabel ?? "Pix (R$)"}
            inputMode="decimal"
            value={pix}
            onChange={(e) => handlePixChange(e.target.value)}
            onBlur={(e) => handlePixBlur(e.target.value)}
          />
          {modo === "saida" && (
            <CaixaToggle
              modo={modo}
              valorReais={pixReais}
              checked={pixDoCaixa}
              onChange={onPixDoCaixaChange}
            />
          )}
        </div>
        <div className="space-y-2">
          <FormInput
            label={dinheiroLabel ?? "Dinheiro (R$)"}
            inputMode="decimal"
            value={dinheiro}
            onChange={(e) => handleDinheiroChange(e.target.value)}
            onBlur={(e) => handleDinheiroBlur(e.target.value)}
          />
          {modo === "saida" && (
            <CaixaToggle
              modo={modo}
              valorReais={dinheiroReais}
              checked={dinheiroDoCaixa}
              onChange={onDinheiroDoCaixaChange}
            />
          )}
        </div>
      </div>

      {totalInformado > 0.009 && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Total informado</span>
            <span className="font-semibold tabular-nums text-white">
              {formatCurrency(totalInformado)}
            </span>
          </div>
          {modo === "saida" && (
            <>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Sai do caixa</span>
                <span className="font-semibold tabular-nums text-primary-neon">
                  {formatCurrency(movimentaCaixa)}
                </span>
              </div>
              {foraCaixa > 0.009 && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Fora do caixa</span>
                  <span className="tabular-nums text-slate-400">{formatCurrency(foraCaixa)}</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                O valor fora do caixa continua valendo na coleta (negócio, pendência ou negativo) —
                só não movimenta o financeiro.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
