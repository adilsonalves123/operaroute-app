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
      ? "Marcado = entra no financeiro."
      : "Marcado = sai do financeiro.";

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
        checked
          ? "border-primary-neon/50 bg-primary-neon/10"
          : "border-slate-700/60 bg-slate-900/40 hover:border-slate-600"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-primary-neon focus:ring-primary-neon/40"
      />
      <span className="min-w-0 flex-1 text-sm font-medium text-white">{titulo}</span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-at-primary/85">
        {formatCurrency(valorReais)}
      </span>
      <span className="sr-only">{descricao}</span>
    </label>
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
  // Entrada e saída (adiantamento negativo): valor informado movimenta o caixa por padrão.
  const automaticoNoCaixa = true;
  const detalhe: MovimentoCaixaDetalhe = {
    pixReais,
    dinheiroReais,
    pixDoCaixa: automaticoNoCaixa ? pixReais > 0.009 : pixDoCaixa,
    dinheiroDoCaixa: automaticoNoCaixa ? dinheiroReais > 0.009 : dinheiroDoCaixa,
  };
  const totalInformado = pixReais + dinheiroReais;
  const movimentaCaixa = valorMovimentoCaixa(detalhe);
  const foraCaixa = valorForaCaixa(detalhe);
  // Sem toggle: o informado sempre movimenta o caixa (entrada ou adiantamento).
  const mostraToggleCaixa = false;

  function handlePixChange(raw: string) {
    const formatted = formatMoneyInput(raw);
    onPixChange(formatted);
    if (automaticoNoCaixa) {
      onPixDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  function handlePixBlur(raw: string) {
    const formatted = formatMoneyInputOnBlur(raw);
    onPixChange(formatted);
    if (automaticoNoCaixa) {
      onPixDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  function handleDinheiroChange(raw: string) {
    const formatted = formatMoneyInput(raw);
    onDinheiroChange(formatted);
    if (automaticoNoCaixa) {
      onDinheiroDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  function handleDinheiroBlur(raw: string) {
    const formatted = formatMoneyInputOnBlur(raw);
    onDinheiroChange(formatted);
    if (automaticoNoCaixa) {
      onDinheiroDoCaixaChange(parseMoneyInput(formatted) > 0.009);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormInput
          label={pixLabel ?? "Pix (R$)"}
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="0,00"
          value={pix}
          onChange={(e) => handlePixChange(e.target.value)}
          onBlur={(e) => handlePixBlur(e.target.value)}
        />
        <FormInput
          label={dinheiroLabel ?? "Dinheiro (R$)"}
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="0,00"
          value={dinheiro}
          onChange={(e) => handleDinheiroChange(e.target.value)}
          onBlur={(e) => handleDinheiroBlur(e.target.value)}
        />
      </div>

      {mostraToggleCaixa && (pixReais > 0.009 || dinheiroReais > 0.009) && (
        <div className="space-y-2">
          <CaixaToggle
            modo={modo}
            valorReais={pixReais}
            checked={pixDoCaixa}
            onChange={onPixDoCaixaChange}
          />
          <CaixaToggle
            modo={modo}
            valorReais={dinheiroReais}
            checked={dinheiroDoCaixa}
            onChange={onDinheiroDoCaixaChange}
          />
          <p className="text-[11px] text-at-muted leading-snug">
            Desmarcado = valor vale na coleta, mas não movimenta o financeiro.
          </p>
        </div>
      )}

      {totalInformado > 0.009 && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2.5 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-at-muted">Total informado</span>
            <span className="font-semibold tabular-nums text-white">
              {formatCurrency(totalInformado)}
            </span>
          </div>
          {modo === "saida" && (
            <>
              <div className="flex justify-between gap-3">
                <span className="text-at-muted">Sai do caixa</span>
                <span className="font-semibold tabular-nums text-primary-neon">
                  {formatCurrency(movimentaCaixa)}
                </span>
              </div>
              {foraCaixa > 0.009 && (
                <div className="flex justify-between gap-3">
                  <span className="text-at-muted">Fora do caixa</span>
                  <span className="tabular-nums text-at-muted">{formatCurrency(foraCaixa)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
