"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectCard } from "@/components/ui/SelectCard";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { NICHOS } from "@/lib/nicho";
import {
  calcPrecoMensal,
  FAIXAS_PONTOS,
  formatPreco,
  NICHOS_PAGOS,
  type FaixaPontos,
} from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";
import { Building2, Gamepad2, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const nichoIcons = {
  fura_fura: <Gamepad2 className="h-5 w-5" />,
  maquinas_cassino: <Building2 className="h-5 w-5" />,
  outros: <Sparkles className="h-5 w-5" />,
};

type Props = {
  initialFaixa: FaixaPontos;
  initialNichos: Nicho[];
};

export function PlanosCalculator({ initialFaixa, initialNichos }: Props) {
  const router = useRouter();
  const [faixa, setFaixa] = useState<FaixaPontos>(initialFaixa);
  const [nichos, setNichos] = useState<Nicho[]>(initialNichos);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const preco = useMemo(() => calcPrecoMensal(faixa, nichos), [faixa, nichos]);
  const faixaInfo = FAIXAS_PONTOS.find((f) => f.id === faixa);

  const nichosIniciaisKey = initialNichos.slice().sort().join(",");
  const nichosAtuaisKey = nichos.slice().sort().join(",");
  const faixaMudou = faixa !== initialFaixa;
  const nichosMudaram = nichosAtuaisKey !== nichosIniciaisKey;
  const temAlteracao = faixaMudou || nichosMudaram;

  function toggleNicho(nicho: Nicho) {
    setSuccess("");
    setError("");
    setNichos((prev) => {
      if (nicho === "outros") return prev;
      if (prev.includes(nicho)) {
        const next = prev.filter((n) => n !== nicho);
        return next.length === 0 ? [nicho] : next;
      }
      return [...prev, nicho];
    });
  }

  async function handleSalvar() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/empresa/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nichos,
          quantidade_pontos: faixa,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar plano.");
        return;
      }

      setSuccess("Plano salvo! Os nichos já estão ativos na sua operação.");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    `Até ${faixaInfo?.limite === 9999 ? "ilimitados" : faixaInfo?.limite} pontos`,
    `${nichos.filter((n) => NICHOS_PAGOS.includes(n)).length || 1} nicho(s) ativo(s)`,
    "Coletas, financeiro e equipamentos",
    "Trial de 7 dias grátis",
    nichos.filter((n) => NICHOS_PAGOS.includes(n)).length > 1
      ? "Dashboard multi-nicho"
      : `Módulo ${NICHOS[nichos.find((n) => NICHOS_PAGOS.includes(n)) ?? "outros"].label}`,
  ];

  return (
    <>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Planos OperaRoute</h1>
          <p className="text-slate-400 mt-2">
            Preço baseado em pontos + nichos. Pague só pelo que usa.
          </p>
          <p className="text-xs text-amber-400/90 mt-2">
            Marque os nichos e clique em <strong>Salvar plano</strong> para ativar no sistema.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">Quantos pontos você tem?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FAIXAS_PONTOS.map((opt) => (
                  <SelectCard
                    key={opt.id}
                    label={opt.label}
                    selected={faixa === opt.id}
                    onClick={() => {
                      setSuccess("");
                      setError("");
                      setFaixa(opt.id);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">Quais nichos você opera?</p>
              <p className="text-xs text-slate-500">
                &quot;Outros&quot; é incluso. Cada nicho especializado aumenta o valor.
              </p>
              <div className="grid gap-3">
                {NICHOS_PAGOS.map((key) => (
                  <SelectCard
                    key={key}
                    label={NICHOS[key].label}
                    description={NICHOS[key].description}
                    selected={nichos.includes(key)}
                    onClick={() => toggleNicho(key)}
                    icon={nichoIcons[key]}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col border-primary-neon/30 neon-glow">
            <span className="self-start rounded-full bg-primary-neon/20 px-3 py-1 text-xs font-semibold text-primary-neon mb-4">
              Seu plano
            </span>
            <h3 className="text-xl font-bold text-white">
              {nichos.map((n) => NICHOS[n].label).join(" + ")}
            </h3>
            <p className="text-slate-400 text-sm mt-1">{faixaInfo?.label}</p>
            <p className="text-4xl font-bold text-primary-neon mt-6">{formatPreco(preco)}</p>
            {preco === null && (
              <p className="text-sm text-slate-400 mt-2">
                Operações com 100+ pontos — fale conosco pelo WhatsApp.
              </p>
            )}
            <ul className="mt-6 space-y-3 flex-1">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {error && (
              <p className="mt-4 text-sm text-red-400 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-4 text-sm text-green-400 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
                {success}
              </p>
            )}

            <button
              type="button"
              onClick={handleSalvar}
              disabled={loading || preco === null}
              className={cn(
                "mt-6 w-full rounded-lg py-3 font-semibold transition disabled:opacity-50",
                "bg-primary-neon text-slate-900 hover:bg-cyan-300"
              )}
            >
              {loading
                ? "Salvando..."
                : preco === null
                  ? "Falar com vendas"
                  : temAlteracao
                    ? "Salvar plano"
                    : "Plano atual — salvar de novo"}
            </button>
          </div>
        </div>
      </div>

      <LoadingOverlay show={loading} message="Salvando plano..." />
    </>
  );
}
