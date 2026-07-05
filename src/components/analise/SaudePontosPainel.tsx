import Link from "next/link";
import {
  labelSaude,
  type PontoSaudeItem,
  type SaudePontoClasse,
} from "@/lib/dashboard-saude-pontos";
import { cn, formatCurrency } from "@/lib/utils";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

const CONFIG: Record<
  Exclude<SaudePontoClasse, "sem_dados">,
  { titulo: string; descricao: string; icon: typeof ShieldCheck; cor: string; borda: string; fundo: string }
> = {
  forte: {
    titulo: "Pontos fortes",
    descricao: "Maioria das visitas com lucro · tração ≥ 75%",
    icon: ShieldCheck,
    cor: "text-green-400",
    borda: "border-green-500/20",
    fundo: "bg-green-500/[0.04]",
  },
  razoavel: {
    titulo: "Pontos razoáveis",
    descricao: "No equilíbrio — dá para evoluir com atenção",
    icon: ShieldQuestion,
    cor: "text-amber-400",
    borda: "border-amber-500/20",
    fundo: "bg-amber-500/[0.04]",
  },
  fraco: {
    titulo: "Pontos fracos",
    descricao: "Pressão ou prejuízo — priorize visita e ajuste",
    icon: ShieldAlert,
    cor: "text-red-400",
    borda: "border-red-500/20",
    fundo: "bg-red-500/[0.04]",
  },
};

function CardPonto({ item }: { item: PontoSaudeItem }) {
  const cfg = CONFIG[item.classe as Exclude<SaudePontoClasse, "sem_dados">];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <Link
      href={`/pontos/${item.pontoId}`}
      className={cn(
        "block rounded-lg border p-3 transition hover:bg-white/[0.03]",
        cfg.borda,
        cfg.fundo
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{item.nome}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {item.visitas} {item.visitas === 1 ? "visita" : "visitas"} ·{" "}
            {item.impulsos} impulso{item.impulsos === 1 ? "" : "s"} · {item.pressoes} pressão
            {item.pressoes === 1 ? "" : "ões"}
          </p>
        </div>
        <Icon className={cn("h-4 w-4 shrink-0", cfg.cor)} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-medium", cfg.cor)}>{labelSaude(item.classe)}</span>
        <div className="flex items-center gap-2 tabular-nums text-slate-500">
          {item.indice !== null && <span>{item.indice.toFixed(0)}%</span>}
          <span className={item.lucroMes >= 0 ? "text-green-400/80" : "text-red-400/80"}>
            {formatCurrency(item.lucroMes)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ColunaClasse({
  classe,
  itens,
}: {
  classe: Exclude<SaudePontoClasse, "sem_dados">;
  itens: PontoSaudeItem[];
}) {
  const cfg = CONFIG[classe];
  const Icon = cfg.icon;
  const filtrados = itens.filter((i) => i.classe === classe);

  return (
    <div className={cn("rounded-xl border p-4", cfg.borda, cfg.fundo)}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", cfg.cor)} />
            <h3 className={cn("text-sm font-semibold", cfg.cor)}>{cfg.titulo}</h3>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{cfg.descricao}</p>
        </div>
        <span className={cn("text-2xl font-bold tabular-nums", cfg.cor)}>
          {filtrados.length}
        </span>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-xs italic text-slate-600">Nenhum ponto nesta faixa.</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((item) => (
            <CardPonto key={item.pontoId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SaudePontosPainel({
  itens,
  titulo = "Saúde dos pontos",
  subtitulo = "Classificação com base nas visitas do mês",
}: {
  itens: PontoSaudeItem[];
  titulo?: string;
  subtitulo?: string;
}) {
  const classificados = itens.filter((i) => i.classe !== "sem_dados");
  const semDados = itens.filter((i) => i.classe === "sem_dados");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{titulo}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
      </div>

      {classificados.length === 0 ? (
        <div className="bank-card p-6 text-sm text-slate-500">
          Registre coletas este mês para classificar seus pontos em forte, razoável ou fraco.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ColunaClasse classe="forte" itens={itens} />
          <ColunaClasse classe="razoavel" itens={itens} />
          <ColunaClasse classe="fraco" itens={itens} />
        </div>
      )}

      {semDados.length > 0 && (
        <div className="bank-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
            Sem leitura no mês ({semDados.length})
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {semDados.map((p) => p.nome).join(" · ")}
          </p>
        </div>
      )}
    </section>
  );
}
