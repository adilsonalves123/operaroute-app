"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DonoShell } from "@/components/dono/DonoShell";
import type { DonoCommandPayload } from "@/lib/dono/command";
import { cn } from "@/lib/utils";
import { useDonoTheme } from "@/components/dono/DonoTheme";

function formatDay(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function DonoAssinaturasClient({ email }: { email: string }) {
  const [data, setData] = useState<DonoCommandPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useDonoTheme();
  const light = theme === "light";

  useEffect(() => {
    void fetch("/api/dono/command")
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false));
  }, []);

  const card = light
    ? "rounded-2xl border border-stone-200 bg-white"
    : "rounded-2xl border border-at bg-white/[0.02]";

  return (
    <DonoShell
      email={email}
      badgeSuporte={data?.suporte.humano_aberto}
      title="Assinaturas"
      subtitle="Assinaturas pagas e trials reais — sem shells órfãs."
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin text-at-muted" />
      )}
      {data?.crm && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "Pagas", v: data.crm.assinaturas_ativas },
              { l: "Em trial", v: data.overview.trials },
              { l: "Mensal", v: data.crm.ciclos.mensal },
              { l: "Anual", v: data.crm.ciclos.anual },
            ].map((x) => (
              <div key={x.l} className={cn(card, "p-4")}>
                <p className="text-[11px] uppercase tracking-wider text-at-muted">
                  {x.l}
                </p>
                <p className="mt-1 text-[24px] tabular-nums">{x.v}</p>
              </div>
            ))}
          </div>

          <div className={cn(card, "overflow-hidden")}>
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-inherit text-[10px] uppercase tracking-wider text-at-muted">
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Ciclo</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {data.crm.clientes_recentes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-inherit last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dono/empresas/${c.id}`}
                        className="hover:underline"
                      >
                        {c.empresa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-at-muted">
                      {c.ciclo}
                    </td>
                    <td className="px-4 py-3">{c.status}</td>
                    <td className="px-4 py-3 tabular-nums text-at-muted">
                      {formatDay(c.vencimento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DonoShell>
  );
}
