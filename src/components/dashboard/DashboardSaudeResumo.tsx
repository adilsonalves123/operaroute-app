import Link from "next/link";
import {
  labelSaude,
  mensagemSaudeResumo,
  type SaudePontosResumo,
} from "@/lib/dashboard-saude-pontos";
import { cn } from "@/lib/utils";
import { ArrowRight, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

const CLASSES = [
  {
    key: "forte" as const,
    label: "Fortes",
    icon: ShieldCheck,
    cor: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  {
    key: "razoavel" as const,
    label: "Razoáveis",
    icon: ShieldQuestion,
    cor: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    key: "fraco" as const,
    label: "Fracos",
    icon: ShieldAlert,
    cor: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
];

export function DashboardSaudeResumo({ saude }: { saude: SaudePontosResumo }) {
  const total = saude.contagem.forte + saude.contagem.razoavel + saude.contagem.fraco;
  if (total === 0 && saude.mes.length === 0) return null;

  const hint = mensagemSaudeResumo(saude);
  const destaque = saude.mes.find((p) => p.classe === "fraco") ?? saude.mes.find((p) => p.classe === "forte");

  return (
    <div className="bank-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0 space-y-2">
        <p className="text-sm text-slate-400">{hint}</p>
        {destaque && (
          <p className="text-xs text-slate-600">
            {labelSaude(destaque.classe)}:{" "}
            <span className="text-slate-400">{destaque.nome}</span>
            {destaque.indice !== null && (
              <span className="text-slate-600"> · {destaque.indice.toFixed(0)}% tração</span>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {CLASSES.map(({ key, label, icon: Icon, cor, bg }) => (
          <div
            key={key}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2",
              bg
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", cor)} />
            <span className={cn("text-lg font-bold tabular-nums leading-none", cor)}>
              {saude.contagem[key]}
            </span>
            <span className="text-[11px] text-slate-500">{label}</span>
          </div>
        ))}

        <Link
          href="/analise"
          className="inline-flex items-center gap-1 rounded-lg border border-blue-500/20 px-3 py-2 text-xs font-medium text-primary-neon transition hover:bg-blue-500/10"
        >
          Ver análise
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
