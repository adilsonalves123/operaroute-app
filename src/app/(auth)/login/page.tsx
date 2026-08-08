"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthLegalLinks } from "@/components/auth/AuthLegalLinks";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setError(
          "Confirme sua conta antes de entrar (e-mail, SMS ou WhatsApp)."
        );
      } else {
        setError("E-mail ou senha incorretos.");
      }
      setLoading(false);
      return;
    }

    try {
      sessionStorage.removeItem("or_auditoria_sessao");
    } catch {
      // ignore
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completo")
      .single();

    router.push(profile?.onboarding_completo ? "/dashboard" : "/pesquisa");
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
          Platform access
        </p>
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#f4f7fb]">
          Entrar na operação
        </h1>
        <p className="text-[13.5px] leading-relaxed text-[#8b93a3]">
          Seu painel, pontos e rotas — do jeito que você deixou.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#7a8494]">
            E-mail
          </span>
          <input
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input-v2"
          />
        </label>

        <AuthPasswordField
          label="Senha"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#8b93a3]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="auth-check-v2"
            />
            Manter conectado
          </label>
          <Link
            href="/esqueci-senha"
            className="text-[13px] text-[#c9a87c] transition hover:text-[#e0c9a0]"
          >
            Esqueci a senha
          </Link>
        </div>

        {error && (
          <p className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="auth-submit-v2">
          {loading ? "Autenticando…" : "Entrar"}
        </button>
      </form>

      <div className="space-y-4 pt-1">
        <Link href="/cadastro" className="auth-secondary-v2">
          Criar conta · 7 dias grátis
        </Link>
        <AuthLegalLinks />
      </div>

      <LoadingOverlay
        show={loading}
        messages={[
          "Verificando suas credenciais...",
          "Preparando seu painel...",
          "Quase lá...",
        ]}
      />
    </div>
  );
}
