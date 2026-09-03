"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ParceiroLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/parceiro/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no login.");
      router.push("/parceiro");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-at-muted">
          OperaRoute
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Portal do parceiro</h1>
        <p className="mt-2 text-[14px] text-at-muted">
          Acompanhe seu link, indicações e comissões.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-at-soft bg-at-card-soft px-4 py-3 text-[14px] text-white outline-none focus:border-[#c4a574]/40"
        />
        <input
          type="password"
          required
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-xl border border-at-soft bg-at-card-soft px-4 py-3 text-[14px] text-white outline-none focus:border-[#c4a574]/40"
        />
        {erro && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-white py-3 text-[14px] font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="mt-6 text-center text-[12px] text-at-soft">
        <Link href="/dono/login" className="hover:text-at-muted">
          Acesso do dono
        </Link>
      </p>
    </div>
  );
}
