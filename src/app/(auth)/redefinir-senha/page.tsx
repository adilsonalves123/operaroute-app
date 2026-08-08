"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthLegalLinks } from "@/components/auth/AuthLegalLinks";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSessionOk(Boolean(data.session));
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(
        updateError.message.includes("session")
          ? "Link expirado ou inválido. Solicite uma nova recuperação."
          : "Não foi possível salvar a nova senha. Tente novamente."
      );
      return;
    }

    setOk(true);
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1800);
  }

  if (checking) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-[13px] text-[#8b93a3]">Validando link de recuperação…</p>
      </div>
    );
  }

  if (!sessionOk) {
    return (
      <div className="space-y-7">
        <header className="space-y-2">
          <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#f4f7fb]">
            Link inválido ou expirado
          </h1>
          <p className="text-[13.5px] leading-relaxed text-[#8b93a3]">
            Solicite um novo e-mail de recuperação para continuar.
          </p>
        </header>
        <Link href="/esqueci-senha" className="auth-submit-v2 inline-flex text-center">
          Recuperar senha novamente
        </Link>
        <Link href="/login" className="auth-secondary-v2">
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
          Nova senha
        </p>
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#f4f7fb]">
          Redefinir senha
        </h1>
        <p className="text-[13.5px] leading-relaxed text-[#8b93a3]">
          Escolha uma senha nova para acessar o OperaRoute.
        </p>
      </header>

      {ok ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-[14px] text-emerald-100">
          Senha atualizada. Redirecionando para o login…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthPasswordField
            label="Nova senha"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <AuthPasswordField
            label="Confirmar senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />

          {error && (
            <p className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="auth-submit-v2">
            {loading ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}

      <div className="space-y-4 pt-1">
        <AuthLegalLinks />
      </div>

      <LoadingOverlay show={loading} message="Atualizando senha…" />
    </div>
  );
}
