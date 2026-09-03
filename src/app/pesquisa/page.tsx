"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectCard } from "@/components/ui/SelectCard";
import { NichoCardsCarousel } from "@/components/nichos/NichoCardsCarousel";
import { TrialGratisCard } from "@/components/onboarding/TrialGratisCard";
import { savePesquisaDraft } from "@/lib/onboarding/pesquisa-draft";
import { resumoTrialPorFaixa } from "@/lib/onboarding/trial-resumo";
import type { Nicho } from "@/lib/types/database";

const PONTOS_OPTIONS = [
  { value: "1-10" as const, label: "1 a 10", hint: "Operação enxuta" },
  { value: "11-50" as const, label: "11 a 50", hint: "Em crescimento" },
  { value: "51-100" as const, label: "50 ou mais", hint: "Operação maior" },
];

export default function PesquisaPage() {
  const router = useRouter();
  const [quantidadePontos, setQuantidadePontos] = useState<
    "" | "1-10" | "11-50" | "51-100"
  >("");
  const [nichos, setNichos] = useState<Nicho[]>([]);
  const [possuiFuncionarios, setPossuiFuncionarios] = useState<boolean | null>(
    null
  );
  const [error, setError] = useState("");

  function continuar() {
    setError("");
    if (!quantidadePontos) {
      setError("Selecione quantos pontos você tem.");
      return;
    }
    if (nichos.length === 0) {
      setError("Selecione pelo menos um nicho que você opera.");
      return;
    }
    if (possuiFuncionarios === null) {
      setError("Informe se possui funcionários.");
      return;
    }

    savePesquisaDraft({
      quantidade_pontos: quantidadePontos,
      nichos,
      possui_funcionarios: possuiFuncionarios,
    });
    router.push("/configuracao");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center px-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-primary-neon/80">
            Passo 1 de 2
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Pesquisa rápida</h1>
          <p className="text-at-muted mt-2">
            Só para entender sua operação — leva menos de 1 minuto.
          </p>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 lg:p-8 space-y-3">
            <p className="text-sm font-medium text-at-primary/85">
              Quantos pontos aproximadamente você tem? *
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PONTOS_OPTIONS.map((opt) => (
                <SelectCard
                  key={opt.value}
                  label={opt.label}
                  description={opt.hint}
                  selected={quantidadePontos === opt.value}
                  onClick={() => setQuantidadePontos(opt.value)}
                />
              ))}
            </div>
          </div>

          {quantidadePontos && (
            <TrialGratisCard
              resumo={resumoTrialPorFaixa(quantidadePontos, nichos)}
              compact
            />
          )}

          <div className="glass-card p-6 lg:p-8 overflow-hidden">
            <NichoCardsCarousel
              values={nichos}
              onChangeMulti={setNichos}
              title="Nichos"
              subtitle="Selecione os nichos que você opera *"
            />
            {nichos.length > 0 && (
              <p className="mt-3 text-xs text-at-muted">
                {nichos.length} nicho{nichos.length === 1 ? "" : "s"} selecionado
                {nichos.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div className="glass-card p-6 lg:p-8 space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-at-primary/85">
                Possui funcionários? *
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectCard
                  label="Sim"
                  selected={possuiFuncionarios === true}
                  onClick={() => setPossuiFuncionarios(true)}
                />
                <SelectCard
                  label="Não"
                  selected={possuiFuncionarios === false}
                  onClick={() => setPossuiFuncionarios(false)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={continuar}
              className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 transition hover:bg-cyan-300"
            >
              Continuar para configuração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
