import Link from "next/link";
import { getNichoConfig } from "@/lib/nicho";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { getCassinoDashboardStats } from "@/lib/nichos/cassino/dashboard-stats";
import { getFuraFuraDashboardStats } from "@/lib/nichos/fura-fura/dashboard-stats";
import { getGenericAnaliseData } from "@/lib/dashboard-generic-analise";
import { monthPeriodLabel } from "@/lib/dashboard-greeting";
import { DashboardPulso } from "@/components/dashboard/DashboardPulso";
import { DashboardCartelaPontos } from "@/components/dashboard/DashboardCartelaPontos";
import { DashboardRanking } from "@/components/dashboard/DashboardRanking";
import { DashboardComparativoMes } from "@/components/dashboard/DashboardComparativoMes";
import { SaudePontosPainel } from "@/components/analise/SaudePontosPainel";
import { AnaliseMultiNichoTabs } from "@/components/analise/AnaliseMultiNichoTabs";
import { fetchSaudePontos, type SaudePontosResumo } from "@/lib/dashboard-saude-pontos";
import { computePulsoOperacao } from "@/lib/dashboard-pulso";
import { computeCartelaPontos } from "@/lib/dashboard-cartela-pontos";
import { ArrowLeft } from "lucide-react";
import type { Nicho } from "@/lib/types/database";

export default async function AnalisePage() {
  const profile = await getProfile();
  const empresa = profile?.empresa_id ? await getEmpresa(profile.empresa_id) : null;
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const isCassino = nichosAtivos.includes("maquinas_cassino");
  const isFuraFura = nichosAtivos.includes("fura_fura");
  const isMultiNicho = isCassino && isFuraFura;
  const nicho = (empresa?.nicho ?? profile?.nicho ?? "outros") as Nicho;
  const config = getNichoConfig(nicho);

  const supabase = await createClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const empty = {
    stats: {} as Record<string, number>,
    ranking: [] as { ponto: import("@/lib/types/database").Ponto; valor: number }[],
    sparkline: [] as number[],
    pulso: computePulsoOperacao([]),
    cartela: computeCartelaPontos([], []),
    comparativo: undefined as
      | { mesAtual: { lucroReal: number; coletas: number }; mesAnterior: { lucroReal: number; coletas: number } }
      | undefined,
  };

  let multiCassino = null;
  let multiFura = null;
  let dashData = empty;
  let saude: SaudePontosResumo = {
    mes: [],
    semana: [],
    contagem: { forte: 0, razoavel: 0, fraco: 0, semDados: 0 },
  };

  if (profile?.empresa_id) {
    if (isMultiNicho) {
      const [dashCassino, dashFura, saudeCassino, saudeFura] = await Promise.all([
        getCassinoDashboardStats(supabase, profile.empresa_id, startOfMonth),
        getFuraFuraDashboardStats(supabase, profile.empresa_id, startOfMonth),
        fetchSaudePontos(supabase, profile.empresa_id, "cassino"),
        fetchSaudePontos(supabase, profile.empresa_id, "fura_fura"),
      ]);
      multiCassino = {
        ranking: dashCassino.ranking as typeof empty.ranking,
        pulso: dashCassino.pulso,
        cartela: dashCassino.cartela,
        saude: saudeCassino,
      };
      multiFura = {
        ranking: dashFura.ranking,
        pulso: dashFura.pulso,
        cartela: dashFura.cartela,
        saude: saudeFura,
        comparativo: dashFura.comparativo,
      };
    } else if (isCassino) {
      const [dash, saudeFetched] = await Promise.all([
        getCassinoDashboardStats(supabase, profile.empresa_id, startOfMonth),
        fetchSaudePontos(supabase, profile.empresa_id, "cassino"),
      ]);
      dashData = { ...empty, ...dash, comparativo: undefined };
      saude = saudeFetched;
    } else if (isFuraFura) {
      const dashFura = await getFuraFuraDashboardStats(
        supabase,
        profile.empresa_id,
        startOfMonth
      );
      dashData = dashFura;
      saude = dashFura.saude;
    } else {
      const [dash, saudeFetched] = await Promise.all([
        getGenericAnaliseData(supabase, profile.empresa_id),
        fetchSaudePontos(supabase, profile.empresa_id, "generico"),
      ]);
      dashData = { ...empty, ...dash, comparativo: undefined };
      saude = saudeFetched;
    }
  }

  const { ranking, pulso, cartela, comparativo } = dashData;

  const nichoLabel = isMultiNicho
    ? "Cassino · Fura Fura"
    : isFuraFura
      ? getNichoConfig("fura_fura").label
      : isCassino
        ? getNichoConfig("maquinas_cassino").label
        : config.label;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-primary-neon"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao dashboard
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-600">
            {monthPeriodLabel()} · {nichoLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Análise da operação
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pulso, base de pontos e classificação forte · razoável · fraco
          </p>
        </div>
      </header>

      {isMultiNicho && multiCassino && multiFura ? (
        <AnaliseMultiNichoTabs cassino={multiCassino} furaFura={multiFura} />
      ) : (
        <>
          {comparativo && (
            <DashboardComparativoMes
              lucroAtual={comparativo.mesAtual.lucroReal}
              lucroAnterior={comparativo.mesAnterior.lucroReal}
              coletasAtual={comparativo.mesAtual.coletas}
              coletasAnterior={comparativo.mesAnterior.coletas}
            />
          )}

          <SaudePontosPainel itens={saude.mes} />

          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardPulso pulso={pulso} />
            <DashboardCartelaPontos cartela={cartela} />
          </div>

          {ranking.length > 0 && (
            <DashboardRanking ranking={ranking} title="Ranking financeiro do mês" />
          )}
        </>
      )}
    </div>
  );
}
