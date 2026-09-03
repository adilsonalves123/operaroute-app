"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { AfiliadoRefCapture } from "@/components/afiliados/AfiliadoRefCapture";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { CadastroConfirmarEmail } from "@/components/auth/CadastroConfirmarEmail";
import { CadastroConfirmarCodigo } from "@/components/auth/CadastroConfirmarCodigo";
import {
  labelCanalConfirmacao,
  toE164Brasil,
  type CanalConfirmacao,
} from "@/lib/auth/telefone-br";

const CANAIS: { id: CanalConfirmacao; titulo: string; dica: string }[] = [
  { id: "email", titulo: "E-mail", dica: "Link na caixa de entrada" },
  { id: "sms", titulo: "SMS", dica: "Código no celular" },
  { id: "whatsapp", titulo: "WhatsApp", dica: "Código no Zap" },
];

export default function CadastroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [canal, setCanal] = useState<CanalConfirmacao>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aguardandoEmail, setAguardandoEmail] = useState(false);
  const [aguardandoCodigo, setAguardandoCodigo] = useState(false);
  const [phoneE164, setPhoneE164] = useState("");

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

    const phone = toE164Brasil(form.whatsapp);
    if (!phone) {
      setError("WhatsApp inválido. Use DDD + número (ex.: 11999999999).");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const email = form.email.trim().toLowerCase();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    if (canal === "email") {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            nome: form.nome,
            whatsapp: form.whatsapp,
            confirm_channel: "email",
          },
          emailRedirectTo: `${origin}/auth/callback?next=/pesquisa`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      const identities = data.user?.identities ?? [];
      if (data.user && identities.length === 0) {
        setError("Este e-mail já está cadastrado. Faça login ou recupere a senha.");
        setLoading(false);
        return;
      }

      if (data.user) {
        await supabase
          .from("profiles")
          .update({
            nome: form.nome,
            whatsapp: form.whatsapp,
            email,
          })
          .eq("user_id", data.user.id);
      }

      if (!data.session) {
        setAguardandoEmail(true);
        setLoading(false);
        return;
      }

      router.push("/pesquisa");
      router.refresh();
      return;
    }

    // SMS / WhatsApp — OTP no telefone
    try {
      const check = await fetch("/api/auth/checar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkJson = (await check.json().catch(() => ({}))) as {
        existe?: boolean;
        error?: string;
      };
      if (!check.ok) {
        setError(checkJson.error || "Não foi possível validar o e-mail.");
        setLoading(false);
        return;
      }
      if (checkJson.existe) {
        setError("Este e-mail já está cadastrado. Faça login ou recupere a senha.");
        setLoading(false);
        return;
      }
    } catch {
      setError("Falha de rede ao validar o e-mail. Tente de novo.");
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: canal,
        shouldCreateUser: true,
        data: {
          nome: form.nome,
          email,
          whatsapp: form.whatsapp,
          confirm_channel: canal,
        },
      },
    });

    if (otpError) {
      setError(traduzErroEnvio(otpError.message, canal));
      setLoading(false);
      return;
    }

    setPhoneE164(phone);
    setAguardandoCodigo(true);
    setLoading(false);
  }

  if (aguardandoEmail) {
    return <CadastroConfirmarEmail email={form.email.trim()} />;
  }

  if (aguardandoCodigo) {
    return (
      <CadastroConfirmarCodigo
        canal={canal === "email" ? "sms" : canal}
        phoneE164={phoneE164}
        phoneDisplay={form.whatsapp}
        email={form.email.trim().toLowerCase()}
        password={form.password}
        nome={form.nome}
        whatsapp={form.whatsapp}
        onVoltar={() => {
          setAguardandoCodigo(false);
          setError("");
        }}
      />
    );
  }

  const loadingMsgs =
    canal === "email"
      ? [
          "Criando sua conta...",
          "Enviando e-mail de confirmação...",
          "Quase lá...",
        ]
      : [
          "Criando sua conta...",
          `Enviando código por ${labelCanalConfirmacao(canal)}...`,
          "Quase lá...",
        ];

  return (
    <div className="space-y-7">
      <Suspense fallback={null}>
        <AfiliadoRefCapture />
      </Suspense>

      <header className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#7dd3e8]/75">
          Novo sinal
        </p>
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#f4f7fb]">
          Criar conta
        </h1>
        <p className="text-[13.5px] leading-relaxed text-[#8b93a3]">
          7 dias grátis — confirme por e-mail, SMS ou WhatsApp.
        </p>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {(
          [
            ["nome", "Nome", "text", "Seu nome", form.nome],
            ["whatsapp", "WhatsApp", "tel", "(11) 99999-9999", form.whatsapp],
            ["email", "E-mail", "email", "seu@email.com", form.email],
          ] as const
        ).map(([key, label, type, placeholder, value]) => (
          <label key={key} className="block space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#7a8494]">
              {label}
            </span>
            <input
              type={type}
              placeholder={placeholder}
              value={value}
              onChange={(e) => update(key, e.target.value)}
              required
              className="auth-input-v2"
            />
          </label>
        ))}

        <AuthPasswordField
          label="Senha"
          value={form.password}
          onChange={(v) => update("password", v)}
          placeholder="Mínimo 6 caracteres"
          autoComplete="new-password"
        />
        <AuthPasswordField
          label="Confirmar senha"
          value={form.confirmPassword}
          onChange={(v) => update("confirmPassword", v)}
          placeholder="Repita a senha"
          autoComplete="new-password"
        />

        <fieldset className="space-y-2">
          <legend className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#7a8494]">
            Confirmar conta por
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {CANAIS.map((c) => {
              const ativo = canal === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanal(c.id)}
                  className={`rounded-xl border px-2 py-2.5 text-center transition ${
                    ativo
                      ? "border-[#7dd3e8]/45 bg-[#7dd3e8]/12 text-[#e8e2d6]"
                      : "border-at-soft bg-white/[0.02] text-[#8b93a3] hover:border-at-soft"
                  }`}
                >
                  <span className="block text-[13px] font-medium">{c.titulo}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight opacity-80">
                    {c.dica}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p className="rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="auth-submit-v2">
          {loading ? "Enviando…" : "Começar teste grátis"}
        </button>
      </form>

      <p className="text-center text-[13px] text-[#8b93a3]">
        Já tem conta?{" "}
        <Link href="/login" className="text-[#c9a87c] hover:text-[#e0c9a0]">
          Entrar
        </Link>
      </p>

      <LoadingOverlay show={loading} messages={loadingMsgs} />
    </div>
  );
}

function traduzErroEnvio(message: string, canal: CanalConfirmacao): string {
  const m = message.toLowerCase();
  if (m.includes("whatsapp") && (m.includes("not supported") || m.includes("provider"))) {
    return "WhatsApp ainda não está ativo no provedor. Use SMS ou e-mail, ou configure Twilio WhatsApp no Supabase (Phone provider).";
  }
  if (
    m.includes("unsupported phone provider") ||
    m.includes("phone provider") ||
    m.includes("sms provider") ||
    (m.includes("phone") && m.includes("disabled"))
  ) {
    return `Envio por ${labelCanalConfirmacao(canal)} ainda não configurado. No Supabase: Authentication → Providers → Phone (Twilio). Enquanto isso, confirme por e-mail.`;
  }
  if (m.includes("rate") || m.includes("security")) {
    return "Aguarde cerca de 1 minuto antes de pedir outro código.";
  }
  return message;
}
