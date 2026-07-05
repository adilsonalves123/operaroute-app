"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Route } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { createClient } from "@/lib/supabase/client";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

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
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completo")
      .single();

    router.push(profile?.onboarding_completo ? "/dashboard" : "/configuracao");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="lg:hidden flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-neon/20 neon-glow">
          <Route className="h-6 w-6 text-primary-neon" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            Opera<span className="text-primary-neon">Route</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Controle total da sua operação</p>
        </div>
      </div>

      <div className="hidden lg:block">
        <h2 className="text-2xl font-bold text-white">Entrar</h2>
        <p className="text-slate-400 mt-1">Acesse sua conta OperaRoute</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="E-mail ou telefone"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormInput
          label="Senha"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded accent-primary-neon"
            />
            Manter conectado
          </label>
          <Link href="#" className="text-sm text-primary-neon hover:underline">
            Esqueci minha senha
          </Link>
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
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <Link
        href="/cadastro"
        className="block w-full rounded-lg border border-blue-500/30 py-3 text-center font-medium text-white transition hover:bg-blue-500/10"
      >
        Criar conta grátis
      </Link>

      <footer className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 pt-4 border-t border-slate-800">
        <Link href="#" className="hover:text-slate-300">Termos de uso</Link>
        <Link href="#" className="hover:text-slate-300">Privacidade</Link>
        <a
          href="https://wa.me/5500000000000"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-300"
        >
          Suporte WhatsApp
        </a>
      </footer>

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
