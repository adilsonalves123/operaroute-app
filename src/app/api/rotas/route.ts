import { NextResponse } from "next/server";
import { canGerenciarRotas } from "@/lib/rotas/permissoes-rotas";
import type { RotaSalva } from "@/lib/rotas/rotas-salvas";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";

async function enriquecerRotas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  rotas: { id: string; operador_id: string | null; [key: string]: unknown }[]
): Promise<RotaSalva[]> {
  if (!rotas.length) return [];

  const rotaIds = rotas.map((r) => r.id);
  const { data: paradas } = await supabase
    .from("rota_pontos")
    .select("id, rota_id, ponto_id, ordem, status, observacao")
    .in("rota_id", rotaIds)
    .order("ordem");

  const operadorIds = [
    ...new Set(rotas.map((r) => r.operador_id).filter(Boolean)),
  ] as string[];

  const nomesOperador = new Map<string, string>();
  if (operadorIds.length) {
    const { data: equipe } = await supabase
      .from("equipe")
      .select("user_id, nome")
      .eq("empresa_id", empresaId)
      .in("user_id", operadorIds);
    for (const m of equipe ?? []) {
      if (m.user_id) nomesOperador.set(m.user_id, m.nome);
    }
  }

  const paradasPorRota = new Map<string, RotaSalva["paradas"]>();
  for (const p of paradas ?? []) {
    const list = paradasPorRota.get(p.rota_id) ?? [];
    list.push({
      id: p.id,
      ponto_id: p.ponto_id,
      ordem: p.ordem,
      status: p.status,
      observacao: p.observacao,
    });
    paradasPorRota.set(p.rota_id, list);
  }

  return rotas.map((r) => {
    const ps = paradasPorRota.get(r.id) ?? [];
    return {
      ...(r as RotaSalva),
      paradas: ps.sort((a, b) => a.ordem - b.ordem),
      total_paradas: ps.length,
      operador_nome: r.operador_id ? nomesOperador.get(r.operador_id) ?? null : null,
    };
  });
}

export async function GET() {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const podeGerenciar = await canGerenciarRotas(supabase, profile, empresa?.owner_id);

  let query = supabase
    .from("rotas")
    .select("*")
    .eq("empresa_id", profile.empresa_id)
    .order("created_at", { ascending: false });

  if (!podeGerenciar) {
    query = query.eq("operador_id", profile.user_id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rotas = await enriquecerRotas(supabase, profile.empresa_id, data ?? []);
  return NextResponse.json({ rotas, podeGerenciar });
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);

  if (!(await canGerenciarRotas(supabase, profile, empresa?.owner_id))) {
    return NextResponse.json({ error: "Sem permissão para criar rotas." }, { status: 403 });
  }

  const body = await request.json();
  const nome = String(body.nome ?? "").trim();
  if (!nome) {
    return NextResponse.json({ error: "Informe o nome da rota." }, { status: 400 });
  }

  const paradas: { ponto_id: string; ordem: number }[] = body.paradas ?? [];
  if (paradas.length === 0) {
    return NextResponse.json({ error: "Adicione ao menos um ponto à rota." }, { status: 400 });
  }

  const operadorId = body.operador_id ? String(body.operador_id) : null;

  if (!operadorId) {
    return NextResponse.json(
      { error: "Selecione o operador que vai executar a rota." },
      { status: 400 }
    );
  }

  const cidade = body.cidade ? String(body.cidade).trim() : null;
  if (!cidade) {
    return NextResponse.json({ error: "Informe a cidade da rota." }, { status: 400 });
  }

  if (operadorId) {
    const { data: membro } = await supabase
      .from("equipe")
      .select("id")
      .eq("empresa_id", profile.empresa_id)
      .eq("user_id", operadorId)
      .eq("status", "ativo")
      .maybeSingle();

    if (!membro) {
      return NextResponse.json({ error: "Operador não encontrado na equipe." }, { status: 400 });
    }
  }

  const { data: rota, error: rotaError } = await supabase
    .from("rotas")
    .insert({
      empresa_id: profile.empresa_id,
      nome,
      operador_id: operadorId,
      cidade,
      bairro: body.bairro ? String(body.bairro).trim() : null,
      status: "pendente",
    })
    .select("*")
    .maybeSingle();

  if (rotaError || !rota) {
    return NextResponse.json({ error: rotaError?.message ?? "Erro ao salvar rota" }, { status: 500 });
  }

  const rows = paradas.map((p, i) => ({
    rota_id: rota.id,
    ponto_id: p.ponto_id,
    ordem: p.ordem ?? i + 1,
    status: "pendente",
  }));

  const { error: pontosError } = await supabase.from("rota_pontos").insert(rows);

  if (pontosError) {
    await supabase.from("rotas").delete().eq("id", rota.id);
    return NextResponse.json({ error: pontosError.message }, { status: 500 });
  }

  const [enriquecida] = await enriquecerRotas(supabase, profile.empresa_id, [rota]);
  return NextResponse.json({ success: true, rota: enriquecida });
}
