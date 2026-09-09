"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Instrument_Serif, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dono-login-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-dono-login-sans",
});

export function DonoLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dono/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha no login.");
        return;
      }
      router.push("/dono");
      router.refresh();
    } catch {
      setError("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        display.variable,
        sans.variable,
        "dono-login-root relative flex min-h-dvh items-center justify-center px-4"
      )}
      style={{ fontFamily: "var(--font-dono-login-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(196,165,116,0.14), transparent 55%), linear-gradient(180deg, #05070c 0%, #0a0e16 100%)",
          }}
        />
      </div>

      <div className="w-full max-w-sm">
        <p
          className="text-[11px] font-medium uppercase text-[#e0c9a0]"
          style={{ letterSpacing: "0.28em" }}
        >
          OperaRoute
        </p>
        <h1
          className="mt-3 text-[2.4rem] leading-none tracking-tight text-[#f4efe6]"
          style={{ fontFamily: "var(--font-dono-login-display), Georgia, serif" }}
        >
          Painel do dono
        </h1>
        <p className="mt-3 text-[13px] text-[#b8c0cc]">
          Login separado do app dos clientes. Só você entra aqui.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#c5ccd6]">
              E-mail
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="dono-login-input mt-1.5 w-full rounded-sm border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-[14px] text-[#f4efe6] outline-none focus:border-[#c4a574]/55"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#c5ccd6]">
              Senha
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="dono-login-input mt-1.5 w-full rounded-sm border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-[14px] text-[#f4efe6] outline-none focus:border-[#c4a574]/55"
            />
          </label>

          {error && (
            <p className="rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm border border-[#c4a574]/55 bg-[#c4a574]/20 py-2.5 text-[13px] font-medium text-[#f4efe6] transition hover:bg-[#c4a574]/30 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
