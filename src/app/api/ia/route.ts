import { NextResponse } from "next/server";
import { createClient, getProfile, getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchInteligenciaOperacional } from "@/lib/analise/inteligencia-operacional";
import { gerarAnalisePersonalizada } from "@/lib/ia/analise-personalizada";
import { montarContextoIAPersonalizada } from "@/lib/ia/contexto-operacional";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pergunta = String(body.pergunta ?? "").trim();
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ resposta: "Faça login para usar a IA." });
  }

  if (!pergunta) {
    return NextResponse.json({ resposta: "Digite uma pergunta." });
  }

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
  });

  const ctx = montarContextoIAPersonalizada(
    data,
    empresa?.nome_operacao ?? profile.nome_operacao ?? "Sua operação"
  );

  const resultado = await gerarAnalisePersonalizada(ctx, { pergunta });

  return NextResponse.json({
    resposta: resultado.texto,
    fonte: resultado.fonte,
    aviso: resultado.aviso,
  });
}
