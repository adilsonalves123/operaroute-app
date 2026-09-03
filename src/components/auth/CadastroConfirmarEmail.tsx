"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string;
};

export function CadastroConfirmarEmail({ email }: Props) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  async function reenviar() {
    setSending(true);
    setMsg("");
    setErro("");
    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/pesquisa`,
      },
    });
    setSending(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setMsg("E-mail reenviado. Confira a caixa de entrada e o spam.");
  }

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#7dd3e8]/25 bg-[#7dd3e8]/10">
          <Mail className="h-5 w-5 text-[#7dd3e8]" />
        </div>
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
          Confirmação
        </p>
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#f4f7fb]">
          Confirme seu e-mail
        </h1>
        <p className="text-[13.5px] leading-relaxed text-[#8b93a3]">
          Enviamos um link para{" "}
          <span className="text-[#e8e2d6]">{email}</span>. Abra o e-mail e
          clique em confirmar para liberar os 7 dias grátis.
        </p>
      </header>

      <div className="space-y-3 rounded-xl border border-at-soft bg-at-card-soft px-4 py-3 text-[13px] text-[#8b93a3]">
        <p>Não encontrou? Olhe em spam / promoções.</p>
        <p>Depois de confirmar, volte e faça login.</p>
      </div>

      {msg && (
        <p className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
          {msg}
        </p>
      )}
      {erro && (
        <p className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {erro}
        </p>
      )}

      <button
        type="button"
        disabled={sending}
        onClick={() => void reenviar()}
        className="auth-secondary-v2 inline-flex items-center justify-center gap-2"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
        {sending ? "Reenviando…" : "Reenviar e-mail"}
      </button>

      <p className="text-center text-[13px] text-[#8b93a3]">
        Já confirmou?{" "}
        <Link href="/login" className="text-[#c9a87c] hover:text-[#e0c9a0]">
          Entrar
        </Link>
      </p>
    </div>
  );
}
