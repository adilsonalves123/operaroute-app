import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { visitaPontoDisponivel } from "@/lib/visitas-ponto";
import { resolveNichosAtivos } from "@/lib/assinatura";
import { getEmpresa } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const pontoId = String(body.ponto_id ?? "").trim();
  if (!pontoId) {
    return NextResponse.json({ error: "Informe o ponto." }, { status: 400 });
  }

  const empresa = await getEmpresa(profile.empresa_id);
  const nichosAtivos = resolveNichosAtivos(empresa?.nichos_ativos, empresa?.nicho);
  if (!visitaPontoDisponivel(nichosAtivos)) {
    return NextResponse.json(
      { error: "Visita unificada exige pelo menos dois nichos ativos na operação." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: ponto } = await supabase
    .from("pontos")
    .select("id, nome")
    .eq("id", pontoId)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!ponto) {
    return NextResponse.json({ error: "Ponto não encontrado." }, { status: 404 });
  }

  const { data: rascunhoExistente } = await supabase
    .from("visitas_ponto")
    .select("id")
    .eq("empresa_id", profile.empresa_id)
    .eq("ponto_id", pontoId)
    .eq("status", "rascunho")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rascunhoExistente) {
    return NextResponse.json({
      success: true,
      id: rascunhoExistente.id,
      existente: true,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: visita, error } = await supabase
    .from("visitas_ponto")
    .insert({
      empresa_id: profile.empresa_id,
      ponto_id: pontoId,
      operador_id: user?.id ?? null,
      status: "rascunho",
    })
    .select("id")
    .single();

  if (error || !visita) {
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível iniciar a visita." },
      { status: 500 }
    );
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "visita_ponto.iniciar",
    tabela: "visitas_ponto",
    registroId: visita.id,
    dadosNovos: { ponto_id: pontoId },
    severidade: "info",
    categoria: "coleta",
    modulo: "coletas",
    titulo: "Iniciou visita no ponto",
    resumo: `Ponto ${pontoId}`,
    request,
  });

  return NextResponse.json({ success: true, id: visita.id, existente: false });
}
