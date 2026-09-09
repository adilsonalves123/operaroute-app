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
        "dono-login-page relative flex min-h-dvh items-center justify-center px-4"
      )}
      style={{ fontFamily: "var(--font-dono-login-sans), system-ui, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="dono-login-bg absolute inset-0" />
      </div>

      <div className="w-full max-w-sm">
        <p
          className="dono-login-brand text-[11px] font-medium uppercase"
          style={{ letterSpacing: "0.28em" }}
        >
          OperaRoute
        </p>
        <h1
          className="dono-login-title mt-3 text-[2.4rem] leading-none tracking-tight"
          style={{ fontFamily: "var(--font-dono-login-display), Georgia, serif" }}
        >
          Painel do dono
        </h1>
        <p className="dono-login-sub mt-3 text-[13px] leading-relaxed">
          Login separado do app dos clientes. Só você entra aqui.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="dono-login-label text-[11px] font-medium uppercase tracking-[0.14em]">
              E-mail
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="dono-login-input mt-1.5 w-full rounded-sm px-3.5 py-2.5 text-[14px] outline-none"
            />
          </label>
          <label className="block">
            <span className="dono-login-label text-[11px] font-medium uppercase tracking-[0.14em]">
              Senha
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="dono-login-input mt-1.5 w-full rounded-sm px-3.5 py-2.5 text-[14px] outline-none"
            />
          </label>

          {error && <p className="dono-login-error rounded-sm px-3 py-2 text-[13px]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="dono-login-btn w-full rounded-sm py-2.5 text-[13px] font-semibold transition disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
