import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { parseMoneyInput } from "@/lib/utils";

type ValorBody = { ponto_id: string; valor: number | string };

export async function POST(request: Request) {
  const auth = await requireAcesso("equipe", "editar");
  if (!auth.ok) return auth.response;

  if (auth.acesso.visaoRestrita) {
    return NextResponse.json({ error: "Sem permissão para publicar visão." }, { status: 403 });
  }

  const { profile, supabase } = auth;
  const empresaId = profile.empresa_id!;
  const body = await request.json();
  const data = String(body.data ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: "Informe a data (YYYY-MM-DD)." }, { status: 400 });
  }

  const equipeIds: string[] = Array.isArray(body.equipe_ids)
    ? body.equipe_ids.map((id: unknown) => String(id)).filter(Boolean)
    : [];
  if (equipeIds.length === 0) {
    return NextResponse.json({ error: "Selecione pelo menos um operador." }, { status: 400 });
  }

  const valoresRaw: ValorBody[] = Array.isArray(body.valores) ? body.valores : [];
  const valores = valoresRaw
    .map((v) => ({
      ponto_id: String(v.ponto_id ?? ""),
      valor: typeof v.valor === "number" ? v.valor : parseMoneyInput(String(v.valor ?? "")),
    }))
    .filter((v) => v.ponto_id);

  const { data: membros, error: membrosErr } = await supabase
    .from("equipe")
    .select("id, visao_restrita")
    .eq("empresa_id", empresaId)
    .in("id", equipeIds);

  if (membrosErr) {
    return NextResponse.json({ error: membrosErr.message }, { status: 500 });
  }

  const destinos = (membros ?? []).filter((m) => m.visao_restrita);
  if (destinos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum dos selecionados está com painel restrito." },
      { status: 400 }
    );
  }

  const { data: visaoPontos } = await supabase
    .from("visao_pontos")
    .select("equipe_id, ponto_id")
    .eq("empresa_id", empresaId)
    .in(
      "equipe_id",
      destinos.map((d) => d.id)
    );

  const pontosPorEquipe = new Map<string, Set<string>>();
  for (const row of visaoPontos ?? []) {
    const set = pontosPorEquipe.get(row.equipe_id) ?? new Set<string>();
    set.add(row.ponto_id);
    pontosPorEquipe.set(row.equipe_id, set);
  }

  const rows: {
    empresa_id: string;
    equipe_id: string;
    ponto_id: string;
    data: string;
    valor_exibido: number;
    publicado_em: string;
  }[] = [];
  const agora = new Date().toISOString();

  for (const dest of destinos) {
    const liberados = pontosPorEquipe.get(dest.id);
    if (!liberados || liberados.size === 0) continue;
    for (const v of valores) {
      if (!liberados.has(v.ponto_id)) continue;
      rows.push({
        empresa_id: empresaId,
        equipe_id: dest.id,
        ponto_id: v.ponto_id,
        data,
        valor_exibido: Math.round(v.valor * 100) / 100,
        publicado_em: agora,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Nenhum valor bate com os pontos liberados desses operadores." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("visao_valores").upsert(rows, {
    onConflict: "equipe_id,ponto_id,data",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, publicados: rows.length });
}
