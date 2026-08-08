"use client";

import { useRouter } from "next/navigation";
import { DonoShell, nomeDoEmail } from "@/components/dono/DonoShell";
import { useDonoTheme } from "@/components/dono/DonoTheme";
import { cn } from "@/lib/utils";

export function DonoContaClient({ email }: { email: string }) {
  const router = useRouter();
  const { theme } = useDonoTheme();
  const light = theme === "light";
  const nome = nomeDoEmail(email);

  const card = light
    ? "rounded-2xl border border-stone-200 bg-white p-5"
    : "rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5";

  async function sair() {
    await fetch("/api/dono/login", { method: "DELETE" });
    router.push("/dono/login");
    router.refresh();
  }

  return (
    <DonoShell email={email} title="Minha conta" subtitle="Acesso do dono da plataforma.">
      <div className="max-w-lg space-y-4">
        <div className={card}>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-medium",
                light ? "bg-stone-900 text-white" : "bg-[#c4a574]/25 text-[#e8d5b0]"
              )}
            >
              {nome.slice(0, 1)}
            </span>
            <div>
              <p className="text-[16px] font-medium">{nome}</p>
              <p className="text-[13px] text-slate-500">{email}</p>
            </div>
          </div>
          <p className="mt-4 text-[12px] text-slate-500">
            Login separado do app dos clientes. Credenciais em{" "}
            <code className="text-[11px]">DONO_EMAIL</code> /{" "}
            <code className="text-[11px]">DONO_PASSWORD</code> no{" "}
            <code className="text-[11px]">.env.local</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void sair()}
          className={cn(
            "w-full rounded-xl border px-4 py-2.5 text-[13px]",
            light
              ? "border-rose-200 text-rose-700 hover:bg-rose-50"
              : "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
          )}
        >
          Encerrar sessão
        </button>
      </div>
    </DonoShell>
  );
}
