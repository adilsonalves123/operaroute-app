"use client";

import Link from "next/link";
import { DonoShell } from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import { cn } from "@/lib/utils";

export function DonoConfigClient({ email }: { email: string }) {
  const { theme, setTheme } = useDonoTheme();
  const light = theme === "light";

  const card = light
    ? "rounded-2xl border border-stone-200 bg-white p-5"
    : "rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5";

  return (
    <DonoShell
      email={email}
      title="Configurações"
      subtitle="Preferências do painel da plataforma."
    >
      <div className="max-w-xl space-y-4">
        <div className={card}>
          <p className="text-[13px] font-medium">Aparência</p>
          <p className="mt-1 text-[12px] text-slate-500">
            Tema do painel do dono (não afeta o app dos clientes).
          </p>
          <div className="mt-4 flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={cn(
                  "rounded-xl border px-4 py-2 text-[13px]",
                  theme === t
                    ? light
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-[#c4a574]/50 bg-[#c4a574]/15 text-[#e8d5b0]"
                    : light
                      ? "border-stone-200"
                      : "border-white/10"
                )}
              >
                {t === "dark" ? "Escuro" : "Claro"}
              </button>
            ))}
          </div>
        </div>

        <div className={card}>
          <p className="text-[13px] font-medium">Integrações</p>
          <ul className="mt-3 space-y-2 text-[13px] text-slate-500">
            <li>Supabase · conectado via .env.local</li>
            <li>OpenAI · IA Copiloto e sugestões de suporte</li>
            <li>Gateway de pagamento · em breve (Asaas/Stripe)</li>
          </ul>
        </div>

        <div className={card}>
          <p className="text-[13px] font-medium">SQL necessários</p>
          <ul className="mt-3 space-y-1 text-[12px] text-slate-500">
            <li>supabase/plataforma-receita.sql</li>
            <li>supabase/plataforma-funil.sql</li>
            <li>supabase/plataforma-nichos-covers.sql</li>
            <li>supabase/plataforma-afiliados.sql</li>
            <li>supabase/auditoria-elaborada.sql</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dono/nichos"
            className={cn(
              "inline-block rounded-xl border px-4 py-2.5 text-[13px]",
              light ? "border-stone-200" : "border-white/10"
            )}
          >
            Fotos dos nichos →
          </Link>
          <Link
            href="/dono/conta"
            className={cn(
              "inline-block rounded-xl border px-4 py-2.5 text-[13px]",
              light ? "border-stone-200" : "border-white/10"
            )}
          >
            Ir para minha conta →
          </Link>
        </div>
      </div>
    </DonoShell>
  );
}
