import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface PlanCardProps {
  id: string;
  nome: string;
  preco: string;
  descricao: string;
  features: string[];
  destaque?: boolean;
}

export function PlanCard({ nome, preco, descricao, features, destaque }: PlanCardProps) {
  return (
    <div
      className={cn(
        "glass-card p-6 flex flex-col",
        destaque && "border-primary-neon/50 neon-glow scale-[1.02]"
      )}
    >
      {destaque && (
        <span className="self-start rounded-full bg-primary-neon/20 px-3 py-1 text-xs font-semibold text-primary-neon mb-4">
          Mais popular
        </span>
      )}
      <h3 className="text-xl font-bold text-white">{nome}</h3>
      <p className="text-slate-400 text-sm mt-1">{descricao}</p>
      <p className="text-3xl font-bold text-primary-neon mt-4">{preco}</p>
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
            <Check className="h-4 w-4 text-green-400 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <button
        className={cn(
          "mt-6 w-full rounded-lg py-3 font-semibold transition",
          destaque
            ? "bg-primary-neon text-slate-900 hover:bg-cyan-300"
            : "border border-blue-500/30 text-white hover:bg-blue-500/10"
        )}
      >
        Escolher plano
      </button>
    </div>
  );
}
