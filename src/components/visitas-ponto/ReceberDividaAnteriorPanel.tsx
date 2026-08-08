"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { ColetaRecebimentoFields } from "@/components/coletas/layout";
import { formatCurrency } from "@/lib/utils";

type Props = {
  visitaPontoId: string;
  dividaSaldo: number;
  dividaRecebidaInicio?: number;
};

export function ReceberDividaAnteriorPanel({
  visitaPontoId,
  dividaSaldo,
  dividaRecebidaInicio = 0,
}: Props) {
  const router = useRouter();
  const [pix, setPix] = useState("");
  const [dinheiro, setDinheiro] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  if (dividaSaldo <= 0.009) return null;

  async function handleReceber() {
    setErro("");
    setLoading(true);
    try {
      const res = await fetch(`/api/visitas-ponto/${visitaPontoId}/receber-divida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_pix: pix,
          valor_dinheiro: dinheiro,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro ao registrar recebimento.");
        return;
      }
      setPix("");
      setDinheiro("");
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-200">Dívida antiga do ponto</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-white">
            {formatCurrency(dividaSaldo)}
          </p>
          {dividaRecebidaInicio > 0.009 && (
            <p className="mt-1 text-xs text-slate-400">
              Já recebido no início desta visita: {formatCurrency(dividaRecebidaInicio)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Inclua no Cobrar no final, ou receba só a dívida agora (sem fechar a visita).
          </p>
        </div>
        <Wallet className="h-5 w-5 shrink-0 text-amber-400" />
      </div>

      {!aberto ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Receber agora
          </button>
          <p className="text-xs text-slate-500 self-center">ou marque no Cobrar</p>
        </div>
      ) : (
        <div className="space-y-3 border-t border-amber-500/20 pt-3">
          <ColetaRecebimentoFields
            desconto="0"
            pix={pix}
            dinheiro={dinheiro}
            onDescontoChange={() => {}}
            onPixChange={setPix}
            onDinheiroChange={setDinheiro}
            hint="Quita pendências antigas do ponto (FIFO)."
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReceber}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirmar recebimento
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
