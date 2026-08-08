import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { parseRecebimentoPixDinheiro } from "@/lib/nichos/fura-fura/recebimento-pagamento";
import { aplicarRecebimentoDividaInicio } from "@/lib/visitas-ponto/checkout";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const recebimento = parseRecebimentoPixDinheiro(body);
  if (!recebimento.ok) {
    return NextResponse.json({ error: recebimento.error }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: visita } = await supabase
    .from("visitas_ponto")
    .select("id, status, ponto_id, pontos(nome)")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (!visita || visita.status !== "rascunho") {
    return NextResponse.json({ error: "Visita não encontrada ou já finalizada." }, { status: 400 });
  }

  const ponto = Array.isArray(visita.pontos) ? visita.pontos[0] : visita.pontos;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const resultado = await aplicarRecebimentoDividaInicio(supabase, {
      empresaId: profile.empresa_id,
      visitaPontoId: id,
      pontoId: visita.ponto_id,
      pontoNome: ponto?.nome ?? "Ponto",
      pix: recebimento.data.pix,
      dinheiro: recebimento.data.dinheiro,
      operadorId: user?.id ?? null,
    });

    return NextResponse.json({ success: true, ...resultado });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao receber dívida." },
      { status: 400 }
    );
  }
}
