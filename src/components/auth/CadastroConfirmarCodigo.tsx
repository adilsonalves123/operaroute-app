"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, RefreshCw, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  labelCanalConfirmacao,
  type CanalConfirmacao,
} from "@/lib/auth/telefone-br";

type Props = {
  canal: Exclude<CanalConfirmacao, "email">;
  phoneE164: string;
  phoneDisplay: string;
  email: string;
  password: string;
  nome: string;
  whatsapp: string;
  onVoltar: () => void;
};

export function CadastroConfirmarCodigo({
  canal,
  phoneE164,
  phoneDisplay,
  email,
  password,
  nome,
  whatsapp,
  onVoltar,
}: Props) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const Icon = canal === "whatsapp" ? MessageCircle : Smartphone;
  const canalLabel = labelCanalConfirmacao(canal);

  async function reenviar() {
    setReenviando(true);
    setMsg("");
    setErro("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneE164,
      options: {
        channel: canal,
        shouldCreateUser: true,
        data: {
          nome,
          email,
          whatsapp,
          confirm_channel: canal,
        },
      },
    });
    setReenviando(false);
    if (error) {
      setErro(traduzErroOtp(error.message));
      return;
    }
    setMsg(`Código reenviado por ${canalLabel}.`);
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setMsg("");
    const token = codigo.replace(/\D/g, "");
    if (token.length < 6) {
      setErro("Digite o código de 6 dígitos.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({
      phone: phoneE164,
      token,
      type: "sms",
    });

    if (otpError) {
      setErro(traduzErroOtp(otpError.message));
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/completar-cadastro-telefone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, nome, whatsapp }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setErro(json.error || "Não foi possível finalizar o cadastro.");
      setLoading(false);
      return;
    }

    router.push("/pesquisa");
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#7dd3e8]/25 bg-[#7dd3e8]/10">
          <Icon className="h-5 w-5 text-[#7dd3e8]" />
        </div>
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
          Confirmação
        </p>
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#f4f7fb]">
          Código por {canalLabel}
        </h1>
        <p className="text-[13.5px] leading-relaxed text-[#8b93a3]">
          Enviamos um código para{" "}
          <span className="text-[#e8e2d6]">{phoneDisplay}</span>. Digite abaixo
          para liberar os 7 dias grátis.
        </p>
      </header>

      <form onSubmit={(e) => void confirmar(e)} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#7a8494]">
            Código
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={8}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
            className="auth-input-v2 tracking-[0.35em] text-center text-lg"
          />
        </label>

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

        <button type="submit" disabled={loading} className="auth-submit-v2">
          {loading ? "Confirmando…" : "Confirmar e começar"}
        </button>
      </form>

      <button
        type="button"
        disabled={reenviando}
        onClick={() => void reenviar()}
        className="auth-secondary-v2 inline-flex items-center justify-center gap-2"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${reenviando ? "animate-spin" : ""}`} />
        {reenviando ? "Reenviando…" : `Reenviar por ${canalLabel}`}
      </button>

      <button
        type="button"
        onClick={onVoltar}
        className="w-full text-center text-[13px] text-[#8b93a3] hover:text-[#c9a87c]"
      >
        Voltar e escolher outro canal
      </button>

      <p className="text-center text-[13px] text-[#8b93a3]">
        Já tem conta?{" "}
        <Link href="/login" className="text-[#c9a87c] hover:text-[#e0c9a0]">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function traduzErroOtp(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("whatsapp") && (m.includes("not supported") || m.includes("provider"))) {
    return "WhatsApp ainda não está configurado no provedor SMS. Use SMS ou e-mail, ou configure Twilio WhatsApp no Supabase.";
  }
  if (m.includes("sms") && m.includes("provider")) {
    return "SMS ainda não está configurado. No Supabase: Authentication → Providers → Phone (Twilio). Ou confirme por e-mail.";
  }
  if (m.includes("rate") || m.includes("security")) {
    return "Aguarde cerca de 1 minuto antes de pedir outro código.";
  }
  if (m.includes("token") || m.includes("otp") || m.includes("invalid") || m.includes("expired")) {
    return "Código inválido ou expirado. Peça um novo.";
  }
  return message;
}
