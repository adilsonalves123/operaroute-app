import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { normalizarNumeroSerie } from "@/lib/equipamentos/numero-serie";

/** Busca ponto/equipamento por número de série ou nome do ponto (para abrir chamado). */
export async function GET(request: Request) {
  const auth = await requireAcesso("chamados", "criar");
  if (!auth.ok) return auth.response;

  const { profile, supabase } = auth;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const modo = searchParams.get("modo") === "serie" ? "serie" : "ponto";

  if (q.length < 2) {
    return NextResponse.json(
      { error: "Digite ao menos 2 caracteres." },
      { status: 400 }
    );
  }

  if (modo === "serie") {
    const normalizado = normalizarNumeroSerie(q);
    const { data: equipamentos } = await supabase
      .from("equipamentos")
      .select(
        "id, ponto_id, nome, numero_maquina, numero_serie, tipo, status, pontos(id, nome, status)"
      )
      .eq("empresa_id", profile.empresa_id!)
      .not("numero_serie", "is", null)
      .order("created_at", { ascending: false })
      .limit(80);

    const matches = (equipamentos ?? [])
      .filter((eq) => {
        const serie = String(eq.numero_serie ?? "");
        const n = normalizarNumeroSerie(serie);
        return (
          n.includes(normalizado) ||
          serie.toLowerCase().includes(q.toLowerCase())
        );
      })
      .slice(0, 15)
      .map((eq) => {
        const pontos = eq.pontos as
          | { id: string; nome: string; status: string }
          | { id: string; nome: string; status: string }[]
          | null;
        const ponto = Array.isArray(pontos) ? pontos[0] : pontos;
        return {
          equipamento_id: eq.id,
          equipamento_nome: eq.nome,
          numero_maquina: eq.numero_maquina,
          numero_serie: eq.numero_serie,
          tipo: eq.tipo,
          status: eq.status,
          ponto_id: eq.ponto_id,
          ponto_nome: ponto?.nome ?? "Ponto",
          ponto_status: ponto?.status ?? null,
        };
      });

    return NextResponse.json({ results: matches });
  }

  const { data: pontos } = await supabase
    .from("pontos")
    .select("id, nome, status, cidade, bairro")
    .eq("empresa_id", profile.empresa_id!)
    .ilike("nome", `%${q}%`)
    .order("nome")
    .limit(15);

  const pontoIds = (pontos ?? []).map((p) => p.id);
  let equipamentosPorPonto: Record<
    string,
    {
      id: string;
      nome: string;
      numero_maquina: string | null;
      numero_serie: string | null;
      tipo: string;
    }[]
  > = {};

  if (pontoIds.length > 0) {
    const { data: eqs } = await supabase
      .from("equipamentos")
      .select("id, ponto_id, nome, numero_maquina, numero_serie, tipo, status")
      .eq("empresa_id", profile.empresa_id!)
      .in("ponto_id", pontoIds)
      .neq("status", "inativo");

    for (const eq of eqs ?? []) {
      const list = equipamentosPorPonto[eq.ponto_id] ?? [];
      list.push({
        id: eq.id,
        nome: eq.nome,
        numero_maquina: eq.numero_maquina,
        numero_serie: eq.numero_serie,
        tipo: eq.tipo,
      });
      equipamentosPorPonto[eq.ponto_id] = list;
    }
  }

  const results = (pontos ?? []).map((p) => ({
    ponto_id: p.id,
    ponto_nome: p.nome,
    ponto_status: p.status,
    cidade: p.cidade,
    bairro: p.bairro,
    equipamentos: equipamentosPorPonto[p.id] ?? [],
  }));

  return NextResponse.json({ results });
}
