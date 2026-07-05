"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormInput, FormSelect } from "@/components/ui/FormInput";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getEmpresaIdForUser } from "@/lib/supabase/empresa";
import { saldoPendenteColeta, NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";
import type { Ponto } from "@/lib/types/database";

type ResumoPonto = {
  ponto: Ponto;
  totalPendente: number;
  coletasAbertas: number;
};

export function FuraFuraPendentesClient() {
  const searchParams = useSearchParams();
  const pontoFromUrl = searchParams.get("ponto") ?? "";
  const [pontos, setPontos] = useState<ResumoPonto[]>([]);
  const [selectedPonto, setSelectedPonto] = useState("");
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("dinheiro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const empresaId = await getEmpresaIdForUser(supabase);
      if (!empresaId) return;

      const [{ data: coletas }, { data: pontosData }] = await Promise.all([
        supabase
          .from("coletas")
          .select("ponto_id, valor_a_receber, valor_pago_recebido")
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_FURA_FURA),
        supabase.from("pontos").select("*").eq("empresa_id", empresaId).order("nome"),
      ]);

      const map = new Map<string, { total: number; count: number }>();
      for (const c of coletas ?? []) {
        const saldo = saldoPendenteColeta(c);
        if (saldo <= 0.009 || !c.ponto_id) continue;
        const prev = map.get(c.ponto_id) ?? { total: 0, count: 0 };
        map.set(c.ponto_id, { total: prev.total + saldo, count: prev.count + 1 });
      }

      const resumo: ResumoPonto[] = (pontosData ?? [])
        .filter((p) => map.has(p.id))
        .map((p) => ({
          ponto: p,
          totalPendente: map.get(p.id)!.total,
          coletasAbertas: map.get(p.id)!.count,
        }))
        .sort((a, b) => b.totalPendente - a.totalPendente);

      setPontos(resumo);

      if (pontoFromUrl && resumo.some((r) => r.ponto.id === pontoFromUrl)) {
        const item = resumo.find((r) => r.ponto.id === pontoFromUrl)!;
        setSelectedPonto(pontoFromUrl);
        setValor(String(item.totalPendente.toFixed(2)));
      }
    }
    load();
  }, [success, pontoFromUrl]);

  async function registrarPagamento(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPonto || !valor) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/coletas/fura-fura/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ponto_id: selectedPonto,
          valor: Number(valor),
          forma_pagamento: forma,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao registrar.");
        return;
      }
      setSuccess(
        `Aplicado ${formatCurrency(data.valorAplicado)}` +
          (data.valorSobra > 0.009 ? ` · Sobra ${formatCurrency(data.valorSobra)}` : "")
      );
      setValor("");
      setSelectedPonto("");
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/coletas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Pendências fura-fura</h1>
          <p className="text-sm text-slate-400">
            Pagamento consolidado por ponto — FIFO (mais antiga primeiro)
          </p>
        </div>
      </div>

      {pontos.length === 0 ? (
        <div className="glass-card p-6 text-sm text-slate-500">
          Nenhuma coleta pendente no momento.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {pontos.map(({ ponto, totalPendente, coletasAbertas }) => (
              <button
                key={ponto.id}
                type="button"
                onClick={() => {
                  setSelectedPonto(ponto.id);
                  setValor(String(totalPendente.toFixed(2)));
                }}
                className={`glass-card w-full p-4 text-left transition ${
                  selectedPonto === ponto.id ? "ring-1 ring-primary-neon/50" : ""
                }`}
              >
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{ponto.nome}</p>
                    <p className="text-xs text-slate-500">
                      {coletasAbertas} coleta{coletasAbertas === 1 ? "" : "s"} em aberto
                    </p>
                  </div>
                  <p className="text-lg font-bold text-amber-400 tabular-nums">
                    {formatCurrency(totalPendente)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={registrarPagamento} className="glass-card space-y-4 p-6">
            <h3 className="text-sm font-medium text-slate-300">Registrar recebimento</h3>
            <FormSelect
              label="Ponto"
              value={selectedPonto}
              onChange={(e) => setSelectedPonto(e.target.value)}
              options={[
                { value: "", label: "Selecione..." },
                ...pontos.map(({ ponto, totalPendente }) => ({
                  value: ponto.id,
                  label: `${ponto.nome} — ${formatCurrency(totalPendente)}`,
                })),
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Valor recebido (R$)"
                type="number"
                step="0.01"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              <FormSelect
                label="Forma"
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                options={[
                  { value: "dinheiro", label: "Dinheiro" },
                  { value: "pix", label: "Pix" },
                  { value: "misto", label: "Misto" },
                ]}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">{success}</p>}
            <button
              type="submit"
              disabled={loading || !selectedPonto}
              className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 disabled:opacity-50"
            >
              {loading ? "Registrando..." : "Aplicar pagamento (FIFO)"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
