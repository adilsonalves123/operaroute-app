import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import { calcularPrecisaoIa, type AiReadingRow } from "@/lib/nichos/cassino/ia-precisao";

export async function GET(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const url = new URL(request.url);
  const periodo = resolverPeriodoAnalise({
    periodo: url.searchParams.get("periodo") ?? undefined,
    de: url.searchParams.get("de") ?? undefined,
    ate: url.searchParams.get("ate") ?? undefined,
  });

  const supabase = await createClient();

  let query = supabase
    .from("ai_readings")
    .select(
      "id, equipamento_id, score, confidence, status, final_status, flags, entrada_sugerida, saida_sugerida, entrada_final, saida_final, excecao_contador, correcao_humana, created_at, finalized_at"
    )
    .eq("empresa_id", profile.empresa_id)
    .gte("created_at", periodo.inicioISO)
    .lte("created_at", periodo.fimISO)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data, error } = await query;

  if (error) {
    if (/ai_readings|relation.*does not exist/i.test(error.message)) {
      return NextResponse.json({
        disponivel: false,
        motivo: "Tabela ai_readings ainda não configurada. Rode supabase/ai-readings.sql.",
        resumo: null,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as AiReadingRow[];
  const resumo = calcularPrecisaoIa(rows);

  return NextResponse.json({
    disponivel: true,
    periodo: {
      preset: periodo.preset,
      inicio: periodo.inicioISO,
      fim: periodo.fimISO,
      label: periodo.label,
    },
    resumo,
  });
}
