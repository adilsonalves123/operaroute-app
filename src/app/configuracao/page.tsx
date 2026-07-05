"use client";

import { useState } from "react";
import { FormInput } from "@/components/ui/FormInput";
import { SelectCard } from "@/components/ui/SelectCard";
import { NICHOS } from "@/lib/nicho";
import type { Nicho } from "@/lib/types/database";
import { Gamepad2, Building2, Sparkles } from "lucide-react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

const quantidadeOptions = [
  { value: "1-10", label: "1–10 pontos" },
  { value: "11-30", label: "11–30 pontos" },
  { value: "31-60", label: "31–60 pontos" },
  { value: "61-100", label: "61–100 pontos" },
  { value: "100+", label: "100+ pontos" },
];

const objetivoOptions = [
  { value: "financeiro", label: "Controlar financeiro" },
  { value: "pontos", label: "Organizar pontos" },
  { value: "cobranca", label: "Cobrar clientes" },
  { value: "crescimento", label: "Crescer operação" },
  { value: "outro", label: "Outro" },
];

const nichoIcons = {
  fura_fura: <Gamepad2 className="h-5 w-5" />,
  maquinas_cassino: <Building2 className="h-5 w-5" />,
  outros: <Sparkles className="h-5 w-5" />,
};

export default function ConfiguracaoPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome_operacao: "",
    nicho: "" as Nicho | "",
    quantidade_pontos: "",
    possui_funcionarios: null as boolean | null,
    objetivo_principal: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.nome_operacao || !form.nicho || !form.quantidade_pontos || form.possui_funcionarios === null || !form.objetivo_principal) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
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

      // Navegação completa para evitar loop com middleware
      window.location.href = "/dashboard";
    } catch {
      setError("Não foi possível salvar. Recarregue a página e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Configure sua operação</h1>
          <p className="text-slate-400 mt-2">
            Personalize o app para o seu negócio em poucos passos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 lg:p-8 space-y-6">
          <FormInput
            label="Nome da operação *"
            placeholder="Ex: Operação Centro SP"
            value={form.nome_operacao}
            onChange={(e) => setForm((f) => ({ ...f, nome_operacao: e.target.value }))}
            required
          />

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Nicho *</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(NICHOS) as Nicho[]).map((key) => (
                <SelectCard
                  key={key}
                  label={NICHOS[key].label}
                  description={NICHOS[key].description}
                  selected={form.nicho === key}
                  onClick={() => setForm((f) => ({ ...f, nicho: key }))}
                  icon={nichoIcons[key]}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Quantidade de pontos *</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {quantidadeOptions.map((opt) => (
                <SelectCard
                  key={opt.value}
                  label={opt.label}
                  selected={form.quantidade_pontos === opt.value}
                  onClick={() => setForm((f) => ({ ...f, quantidade_pontos: opt.value }))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Tem funcionários? *</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectCard
                label="Sim"
                selected={form.possui_funcionarios === true}
                onClick={() => setForm((f) => ({ ...f, possui_funcionarios: true }))}
              />
              <SelectCard
                label="Não"
                selected={form.possui_funcionarios === false}
                onClick={() => setForm((f) => ({ ...f, possui_funcionarios: false }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Principal objetivo *</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {objetivoOptions.map((opt) => (
                <SelectCard
                  key={opt.value}
                  label={opt.label}
                  selected={form.objetivo_principal === opt.value}
                  onClick={() => setForm((f) => ({ ...f, objetivo_principal: opt.value }))}
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
