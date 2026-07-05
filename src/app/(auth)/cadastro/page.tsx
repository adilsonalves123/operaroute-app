"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormInput } from "@/components/ui/FormInput";
import { createClient } from "@/lib/supabase/client";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (form.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { nome: form.nome, whatsapp: form.whatsapp },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase
        .from("profiles")
        .update({ nome: form.nome, whatsapp: form.whatsapp, email: form.email })
        .eq("user_id", data.user.id);
    }

    router.push("/configuracao");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Criar conta grátis</h2>
        <p className="text-slate-400 mt-1">7 dias de teste grátis, sem cartão</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Nome completo"
          placeholder="Seu nome"
          value={form.nome}
          onChange={(e) => update("nome", e.target.value)}
          required
        />
        <FormInput
          label="WhatsApp"
          placeholder="(11) 99999-9999"
          value={form.whatsapp}
          onChange={(e) => update("whatsapp", e.target.value)}
          required
        />
        <FormInput
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          required
        />
        <FormInput
          label="Senha"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          required
        />
        <FormInput
          label="Confirmar senha"
          type="password"
          placeholder="Repita a senha"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          required
        />

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
          {loading ? "Criando conta..." : "Criar conta grátis"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-400">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary-neon hover:underline">
          Entrar
        </Link>
      </p>

      <LoadingOverlay
        show={loading}
        messages={[
          "Criando sua conta...",
          "Ativando teste grátis...",
          "Quase lá...",
        ]}
      />
    </div>
  );
}
