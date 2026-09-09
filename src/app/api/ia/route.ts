import { NextResponse } from "next/server";
import { getEmpresa } from "@/lib/supabase/server";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { fetchInteligenciaOperacional } from "@/lib/analise/inteligencia-operacional";
import { gerarAnalisePersonalizada } from "@/lib/ia/analise-personalizada";
import { montarContextoIAPersonalizada } from "@/lib/ia/contexto-operacional";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { clientIp, rateLimitOk } from "@/lib/security/guards";

export async function POST(request: Request) {
  const auth = await requireAcesso("ia", "ver");
  if (!auth.ok) {
    return NextResponse.json({ resposta: "Sem permissão para usar a IA." });
  }
  const { profile, supabase } = auth;
  const ip = clientIp(request);
  if (!rateLimitOk(`ia:${profile.empresa_id}:${ip}`, 30, 60_000)) {
    return NextResponse.json({ resposta: "Muitas perguntas. Aguarde um minuto." });
  }

  const body = await request.json().catch(() => ({}));
  const pergunta = String(body.pergunta ?? "").trim();

  if (!profile?.empresa_id) {
    return NextResponse.json({ resposta: "Faça login para usar a IA." });
  }

  if (!pergunta) {
    return NextResponse.json({ resposta: "Digite uma pergunta." });
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);

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
