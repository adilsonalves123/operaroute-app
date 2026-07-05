import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  agregarNegativosPorPonto,
  parsePeriodoFiltro,
} from "@/lib/financeiro/negativo-recuperacao";
import { periodoLabels, type PeriodoFiltro } from "@/lib/financeiro/periodo";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

const periodos: PeriodoFiltro[] = ["hoje", "7d", "30d", "tudo"];

export default async function NegativosRecuperadosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: periodoRaw } = await searchParams;
  const periodo = parsePeriodoFiltro(periodoRaw);
  const profile = await getProfile();
  const supabase = await createClient();
  const empresaId = profile?.empresa_id;

  const [{ data: visitas }, { data: pendencias }] = empresaId
    ? await Promise.all([
        supabase
          .from("visitas")
          .select("ponto_id, debito_abatido, created_at, pontos(nome)")
          .eq("empresa_id", empresaId)
          .gt("debito_abatido", 0)
          .order("created_at", { ascending: false }),
        supabase
          .from("pendencias")
          .select("id, ponto_id, valor, descricao, pontos(nome)")
          .eq("empresa_id", empresaId)
          .eq("status", "aberta")
          .ilike("tipo", "negativo"),
      ])
    : [{ data: [] }, { data: [] }];

  const linhas = agregarNegativosPorPonto(
    (visitas ?? []) as unknown as Parameters<typeof agregarNegativosPorPonto>[0],
    (pendencias ?? []) as unknown as Parameters<typeof agregarNegativosPorPonto>[1],
    periodo
  );
  const totalRecuperado = linhas.reduce((s, l) => s + l.recuperadoPeriodo, 0);
  const totalEmAberto = linhas.reduce((s, l) => s + l.emAberto, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          href="/financeiro"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Recuperado de negativo</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Por ponto · {periodoLabels[periodo].toLowerCase()}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {periodos.map((p) => (
          <Link
            key={p}
            href={`/financeiro/negativos?periodo=${p}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              periodo === p
                ? "bg-primary-neon/20 text-primary-neon border border-primary-neon/40"
                : "text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            {periodoLabels[p]}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div className="glass-card p-4 border border-orange-500/20">
          <p className="text-sm text-slate-400">Recuperado no período</p>
          <p className="text-xl font-bold text-white mt-0.5">{formatCurrency(totalRecuperado)}</p>
        </div>
        <div className="glass-card p-4 border border-red-500/20">
          <p className="text-sm text-slate-400">Ainda em aberto</p>
          <p className="text-xl font-bold text-red-400 mt-0.5">{formatCurrency(totalEmAberto)}</p>
        </div>
      </div>

      {linhas.length === 0 ? (
        <EmptyState
          title="Nenhum negativo neste período"
          description="Não há recuperação de negativo nem saldo em aberto para exibir."
        />
      ) : (
        <div className="space-y-2">
          {linhas.map((linha) => (
            <Link
              key={linha.pontoId}
              href={`/pontos/${linha.pontoId}`}
              className="glass-card flex items-center justify-between gap-4 p-4 hover:border-orange-500/30 transition"
            >
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{linha.pontoNome}</p>
                {linha.recuperadoPeriodo > 0.009 ? (
                  <p className="text-sm text-orange-400 mt-0.5">
                    Recuperado: {formatCurrency(linha.recuperadoPeriodo)}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 mt-0.5">Sem recuperação no período</p>
                )}
              </div>
              <div className="text-right shrink-0">
                {linha.emAberto > 0.009 ? (
                  <>
                    <p className="text-xs text-slate-500">Falta</p>
                    <p className="font-semibold text-red-400">{formatCurrency(linha.emAberto)}</p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-green-400">Quitado</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
