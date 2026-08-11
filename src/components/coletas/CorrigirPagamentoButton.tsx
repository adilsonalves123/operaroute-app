"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { cn, formatCurrency, formatMoneyInputOnBlur, parseMoneyInput } from "@/lib/utils";

type Props = {
  /** coleta = nichos · visita = cassino */
  tipo: "coleta" | "visita";
  id: string;
  valorAReceber: number;
  valorPixInicial: number;
  valorDinheiroInicial: number;
  className?: string;
};

export function CorrigirPagamentoButton({
  tipo,
  id,
  valorAReceber,
  valorPixInicial,
  valorDinheiroInicial,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pix, setPix] = useState("");
  const [dinheiro, setDinheiro] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const aReceber = Math.max(0, valorAReceber);

  function abrir() {
    setErro("");
    setOk("");
    setPix(
      valorPixInicial > 0.009
        ? formatMoneyInputOnBlur(valorPixInicial.toFixed(2).replace(".", ","))
        : ""
    );
    setDinheiro(
      valorDinheiroInicial > 0.009
        ? formatMoneyInputOnBlur(valorDinheiroInicial.toFixed(2).replace(".", ","))
        : ""
    );
    setOpen(true);
  }

  const totalInformado = useMemo(
    () => parseMoneyInput(pix) + parseMoneyInput(dinheiro),
    [pix, dinheiro]
  );

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
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 hover:border-white/25 hover:bg-white/[0.07]"
      >
        <Pencil className="h-3.5 w-3.5" />
        Corrigir pagamento
      </button>

      {ok && !open && <p className="text-xs text-emerald-400">{ok}</p>}

      {open && (
        <div className="rounded-xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-white">Corrigir pagamento</p>
            <p className="mt-1 text-xs text-slate-500">
              Só altera Pix / dinheiro e o valor recebido. Não mexe em lucro, comissão nem
              brindes.
              {aReceber > 0.009 && (
                <>
                  {" "}
                  Cobrança desta coleta:{" "}
                  <strong className="text-slate-300">{formatCurrency(aReceber)}</strong>
                </>
              )}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-slate-500">Pix (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={pix}
                onChange={(e) => setPix(e.target.value)}
                onBlur={() => setPix(formatMoneyInputOnBlur(pix))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                placeholder="0,00"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-slate-500">Dinheiro (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={dinheiro}
                onChange={(e) => setDinheiro(e.target.value)}
                onBlur={() => setDinheiro(formatMoneyInputOnBlur(dinheiro))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                placeholder="0,00"
              />
            </label>
          </div>

          <p className="text-xs text-slate-400">
            Total informado:{" "}
            <span className="tabular-nums text-slate-200">{formatCurrency(totalInformado)}</span>
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
              className="rounded-lg border border-slate-700 px-3.5 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
