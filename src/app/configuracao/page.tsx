"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/FormInput";
import { SelectCard } from "@/components/ui/SelectCard";
import { NichoCardsCarousel } from "@/components/nichos/NichoCardsCarousel";
import {
  clearPesquisaDraft,
  loadPesquisaDraft,
  savePesquisaDraft,
  type PesquisaDraft,
} from "@/lib/onboarding/pesquisa-draft";
import type { Nicho } from "@/lib/types/database";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { TrialGratisCard } from "@/components/onboarding/TrialGratisCard";
import { resumoTrialPorFaixa } from "@/lib/onboarding/trial-resumo";

const objetivoOptions = [
  { value: "financeiro", label: "Controlar financeiro" },
  { value: "pontos", label: "Organizar pontos" },
  { value: "cobranca", label: "Cobrar clientes" },
  { value: "crescimento", label: "Crescer operação" },
  { value: "outro", label: "Outro" },
];

const PONTOS_LABEL: Record<PesquisaDraft["quantidade_pontos"], string> = {
  "1-10": "1 a 10",
  "11-50": "11 a 50",
  "51-100": "50 ou mais",
};

export default function ConfiguracaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pesquisa, setPesquisa] = useState<PesquisaDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [nomeOperacao, setNomeOperacao] = useState("");
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [nichos, setNichos] = useState<Nicho[]>([]);

  useEffect(() => {
    const draft = loadPesquisaDraft();
    if (!draft) {
      router.replace("/pesquisa");
      return;
    }
    setPesquisa(draft);
    setNichos(draft.nichos);
    setReady(true);
  }, [router]);

  function toggleObjetivo(value: string) {
    setObjetivos((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function onChangeNichos(next: Nicho[]) {
    setNichos(next);
    if (!pesquisa) return;
    savePesquisaDraft({
      quantidade_pontos: pesquisa.quantidade_pontos,
      nichos: next,
      possui_funcionarios: pesquisa.possui_funcionarios,
    });
    setPesquisa((p) => (p ? { ...p, nichos: next } : p));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pesquisa) {
      router.replace("/pesquisa");
      return;
    }
    if (!nomeOperacao.trim()) {
      setError("Informe o nome da operação.");
      return;
    }
    if (nichos.length === 0) {
      setError("Selecione pelo menos um nicho.");
      return;
    }
    if (objetivos.length === 0) {
      setError("Selecione pelo menos um objetivo.");
      return;
    }

    const nichoPrincipal = nichos[0] as Nicho;
    const objetivoPrincipal = objetivos.join(",");

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nome_operacao: nomeOperacao.trim(),
          nicho: nichoPrincipal,
          nichos,
          quantidade_pontos: pesquisa.quantidade_pontos,
          possui_funcionarios: pesquisa.possui_funcionarios,
          objetivo_principal: objetivoPrincipal,
        }),
      });

      let data: { error?: string; success?: boolean } = {};
      try {
        data = await res.json();
      } catch {
        setError("Erro no servidor. Recarregue a página e tente novamente.");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar configuração.");
        return;
      }

      clearPesquisaDraft();
      try {
        sessionStorage.setItem("or_trial_welcome", "1");
      } catch {
        // ignore
      }
      window.location.href = "/dashboard?bemvindo=1";
    } catch {
      setError("Não foi possível salvar. Recarregue a página e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !pesquisa) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center px-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-primary-neon/80">
            Passo 2 de 2
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Configure sua operação
          </h1>
          <p className="text-slate-400 mt-2">
            Pode marcar mais de um nicho e mais de um objetivo.
          </p>
        </div>

        <TrialGratisCard
          resumo={resumoTrialPorFaixa(pesquisa.quantidade_pontos, nichos)}
        />

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
          <p>
            Pontos:{" "}
            <span className="text-slate-200">
              {PONTOS_LABEL[pesquisa.quantidade_pontos]}
            </span>
            {" · "}
            Funcionários:{" "}
            <span className="text-slate-200">
              {pesquisa.possui_funcionarios ? "Sim" : "Não"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => router.push("/pesquisa")}
            className="mt-2 text-xs text-primary-neon hover:underline"
          >
            Alterar pesquisa
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          <div className="glass-card p-6 lg:p-8 space-y-6">
            <FormInput
              label="Nome da operação *"
              placeholder="Ex: Operação Centro SP"
              value={nomeOperacao}
              onChange={(e) => setNomeOperacao(e.target.value)}
              required
            />
          </div>

          <div className="glass-card p-6 lg:p-8 overflow-hidden">
            <NichoCardsCarousel
              values={nichos}
              onChangeMulti={onChangeNichos}
              title="Nichos"
              subtitle="Quais nichos essa operação vai usar? (pode marcar vários) *"
            />
            {nichos.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {nichos.length} nicho{nichos.length === 1 ? "" : "s"} selecionado
                {nichos.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div className="glass-card p-6 lg:p-8 space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">
                Objetivos *{" "}
                <span className="font-normal text-slate-500">
                  (pode marcar mais de um)
                </span>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {objetivoOptions.map((opt) => (
                  <SelectCard
                    key={opt.value}
                    label={opt.label}
                    selected={objetivos.includes(opt.value)}
                    onClick={() => toggleObjetivo(opt.value)}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-neon py-3 font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Finalizar configuração"}
            </button>
          </div>
        </form>
      </div>

      <LoadingOverlay
        show={loading}
        messages={[
          "Configurando sua operação...",
          "Preparando o sistema...",
          "Quase lá...",
        ]}
      />
    </div>
  );
}
