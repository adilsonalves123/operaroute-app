import { NextResponse } from "next/server";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchInteligenciaOperacional } from "@/lib/analise/inteligencia-operacional";
import {
  gerarAnalisePersonalizada,
  type AnalisePersonalizadaResult,
} from "@/lib/ia/analise-personalizada";
import { montarContextoIAPersonalizada } from "@/lib/ia/contexto-operacional";
import { iaDisponivel } from "@/lib/ia/openai-client";

import { resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";

type HistoricoItem = { role: "user" | "assistant"; content: string };

type BodyIA = {
  pergunta?: string;
  historico?: HistoricoItem[];
  periodo?: string;
  de?: string;
  ate?: string;
};

export async function GET() {
  return NextResponse.json({
    disponivel: true,
    openai: iaDisponivel(),
  });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  let body: BodyIA = {};
  try {
    body = await request.json();
  } catch {
    /* briefing sem body */
  }

  const periodo = resolverPeriodoAnalise({
    periodo: body.periodo,
    de: body.de,
    ate: body.ate,
  });

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  const supabase = await createClient();

  const data = await fetchInteligenciaOperacional(supabase, profile.empresa_id, {
    cassino: nichosAtivos.includes("maquinas_cassino"),
    furaFura: nichosAtivos.includes("fura_fura"),
    ursinho:
      nichosAtivos.includes("ursinho") || nichosAtivos.includes("vending_ursinho"),
    diversao: nichosAtivos.includes("diversao"),
    bolinha: nichosAtivos.includes("bolinha"),
    consignado: nichosAtivos.includes("consignado"),
    periodo,
  });

  const ctx = montarContextoIAPersonalizada(
    data,
    empresa?.nome_operacao ?? profile.nome_operacao ?? "Sua operação"
  );

  const resultado: AnalisePersonalizadaResult = await gerarAnalisePersonalizada(ctx, {
    pergunta: body.pergunta,
    historico: body.historico,
  });

  return NextResponse.json(resultado);
}
