"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AuthLegalLinks } from "@/components/auth/AuthLegalLinks";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
      }
    );

    setLoading(false);

    if (resetError) {
      setError("Não foi possível enviar o e-mail. Tente novamente em instantes.");
      return;
    }

    // Sempre mostra sucesso (evita enumerar contas)
    setEnviado(true);
  }

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
          Recuperação
        </p>
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#f4f7fb]">
          Esqueci a senha
        </h1>
        <p className="text-[13.5px] leading-relaxed text-[#8b93a3]">
          Informe o e-mail da conta. Se existir cadastro, enviamos um link para
          criar uma nova senha.
        </p>
      </header>

      {enviado ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-[14px] leading-relaxed text-emerald-100">
            Se houver uma conta com <strong className="text-white">{email.trim()}</strong>,
            o e-mail de redefinição já foi enviado. Confira também a caixa de spam.
          </div>
          <Link href="/login" className="auth-submit-v2 inline-flex text-center">
            Voltar ao login
          </Link>
        </div>
      ) : (
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

          {error && (
            <p className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="auth-submit-v2">
            {loading ? "Enviando…" : "Enviar link de recuperação"}
          </button>
        </form>
      )}

      <div className="space-y-4 pt-1">
        <Link href="/login" className="auth-secondary-v2">
          Voltar ao login
        </Link>
        <AuthLegalLinks />
      </div>

      <LoadingOverlay show={loading} message="Enviando e-mail de recuperação…" />
    </div>
  );
}
