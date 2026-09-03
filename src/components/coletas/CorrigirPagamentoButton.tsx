"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import {
  cn,
  formatCurrency,
  formatMoneyInput,
  formatMoneyInputOnBlur,
  parseMoneyInput,
} from "@/lib/utils";

type Props = {
  /** coleta = nichos · visita = cassino */
  tipo: "coleta" | "visita";
  id: string;
  /** Valor da cobrança (a receber / total da coleta). */
  valorAReceber: number;
  valorPixInicial: number;
  valorDinheiroInicial: number;
  /** Quanto já consta como pago (fallback se Pix/dinheiro não foram gravados). */
  valorPagoInicial?: number;
  className?: string;
};

function moneyFromReais(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return "";
  // Sempre via dígitos da máscara (evita parse ambíguo de "100.00").
  const cents = Math.round(v * 100);
  return formatMoneyInput(String(cents));
}

function valoresIniciais(opts: {
  pix: number;
  dinheiro: number;
  pago: number;
  aReceber: number;
}): { pix: string; dinheiro: string } {
  const pixIni = Math.max(0, opts.pix);
  const dinIni = Math.max(0, opts.dinheiro);
  if (pixIni + dinIni > 0.009) {
    return { pix: moneyFromReais(pixIni), dinheiro: moneyFromReais(dinIni) };
  }

  const total = Math.max(opts.pago, opts.aReceber, 0);
  if (total > 0.009) {
    return { pix: moneyFromReais(total), dinheiro: "" };
  }

  return { pix: "", dinheiro: "" };
}

export function CorrigirPagamentoButton({
  tipo,
  id,
  valorAReceber,
  valorPixInicial,
  valorDinheiroInicial,
  valorPagoInicial = 0,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pix, setPix] = useState("");
  const [dinheiro, setDinheiro] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const aReceber = Math.max(0, Number(valorAReceber) || 0);
  const pagoInicial = Math.max(0, Number(valorPagoInicial) || 0);

  useEffect(() => {
    if (!open) return;
    const next = valoresIniciais({
      pix: Number(valorPixInicial) || 0,
      dinheiro: Number(valorDinheiroInicial) || 0,
      pago: pagoInicial,
      aReceber,
    });
    setPix(next.pix);
    setDinheiro(next.dinheiro);
    setErro("");
  }, [
    open,
    valorPixInicial,
    valorDinheiroInicial,
    pagoInicial,
    aReceber,
  ]);

  function abrir() {
    setOk("");
    setErro("");
    const next = valoresIniciais({
      pix: Number(valorPixInicial) || 0,
      dinheiro: Number(valorDinheiroInicial) || 0,
      pago: pagoInicial,
      aReceber,
    });
    setPix(next.pix);
    setDinheiro(next.dinheiro);
    setOpen(true);
  }

  const totalInformado = useMemo(
    () => parseMoneyInput(pix) + parseMoneyInput(dinheiro),
    [pix, dinheiro]
  );

  const totalSugestao = Math.max(aReceber, pagoInicial, 0);

  function preencherTudoNoPix() {
    if (totalSugestao <= 0.009) return;
    setPix(moneyFromReais(totalSugestao));
    setDinheiro("");
  }

  function preencherTudoNoDinheiro() {
    if (totalSugestao <= 0.009) return;
    setPix("");
    setDinheiro(moneyFromReais(totalSugestao));
  }

  async function salvar() {
    setBusy(true);
    setErro("");
    setOk("");
    try {
      const url =
        tipo === "visita"
          ? `/api/visitas/cassino/${id}/pagamento`
          : `/api/coletas/${id}/pagamento`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_pix: pix,
          valor_dinheiro: dinheiro,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((data as { error?: string }).error ?? "Não foi possível corrigir.");
        return;
      }
      setOk("Pagamento corrigido.");
      setOpen(false);
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-2 rounded-lg border border-at-soft bg-at-card-soft px-3 py-2 text-sm text-at-primary/90 hover:border-white/25 hover:bg-white/[0.07]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Corrigir pagamento
      </button>

      {ok && !open && <p className="text-xs text-emerald-400">{ok}</p>}

      {open && (
        <div className="rounded-xl border border-at-soft bg-slate-950/80 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-white">Corrigir pagamento</p>
            <p className="mt-1 text-xs text-at-muted">
              Só altera Pix / dinheiro e o valor recebido. Não mexe em lucro, comissão nem
              brindes.
              {totalSugestao > 0.009 && (
                <>
                  {" "}
                  Valor da coleta:{" "}
                  <strong className="text-at-primary/85">{formatCurrency(totalSugestao)}</strong>
                </>
              )}
            </p>
          </div>

          {totalSugestao > 0.009 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={preencherTudoNoPix}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20"
              >
                Tudo no Pix ({formatCurrency(totalSugestao)})
              </button>
              <button
                type="button"
                onClick={preencherTudoNoDinheiro}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
              >
                Tudo no dinheiro ({formatCurrency(totalSugestao)})
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-at-muted">Pix (R$)</span>
              <input
                type="text"
                inputMode="numeric"
                value={pix}
                onChange={(e) => setPix(formatMoneyInput(e.target.value))}
                onBlur={() => setPix(formatMoneyInputOnBlur(pix))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                placeholder="0,00"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-at-muted">Dinheiro (R$)</span>
              <input
                type="text"
                inputMode="numeric"
                value={dinheiro}
                onChange={(e) => setDinheiro(formatMoneyInput(e.target.value))}
                onBlur={() => setDinheiro(formatMoneyInputOnBlur(dinheiro))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                placeholder="0,00"
                autoComplete="off"
              />
            </label>
          </div>

          <p className="text-xs text-at-muted">
            Total informado:{" "}
            <span className="tabular-nums text-at-primary/90">{formatCurrency(totalInformado)}</span>
            {aReceber > 0.009 && totalInformado > aReceber + 0.009 && (
              <span className="text-amber-400">
                {" "}
                — acima da cobrança; será limitado a {formatCurrency(aReceber)}
              </span>
            )}
          </p>

          {erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erro}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void salvar()}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar correção
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-700 px-3.5 py-2 text-sm text-at-muted hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
