import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getAfiliadoSession } from "@/lib/afiliados/session";
import { linkAfiliado, toPublicAfiliado, type AfiliadoRow } from "@/lib/afiliados/core";

export async function GET(request: Request) {
  const session = await getAfiliadoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const admin = createAdminClient();
  const origin = new URL(request.url).origin;
  const { data: afiliado } = await admin
    .from("plataforma_afiliados")
    .select("*")
    .eq("id", session.afiliado_id)
    .maybeSingle();

  if (!afiliado || !(afiliado as AfiliadoRow).ativo) {
    return NextResponse.json({ error: "Conta indisponível." }, { status: 403 });
  }

  const id = session.afiliado_id;
  const [{ data: comissoes }, { data: empresas }, { count: clicks }, { count: cadastros }] =
    await Promise.all([
      admin
        .from("plataforma_afiliado_comissoes")
        .select("*")
        .eq("afiliado_id", id)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("empresas")
        .select("id, nome_operacao, created_at, afiliado_atribuido_em, ciclo_cobranca")
        .eq("afiliado_id", id)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("plataforma_afiliado_eventos")
        .select("id", { count: "exact", head: true })
        .eq("afiliado_id", id)
        .eq("tipo", "click"),
      admin
        .from("plataforma_afiliado_eventos")
        .select("id", { count: "exact", head: true })
        .eq("afiliado_id", id)
        .eq("tipo", "cadastro"),
    ]);

  let pendente = 0;
  let pago = 0;
  for (const c of comissoes ?? []) {
    if (c.status === "pendente") pendente += c.valor_centavos;
    if (c.status === "pago") pago += c.valor_centavos;
  }

  const row = afiliado as AfiliadoRow;
  return NextResponse.json({
    afiliado: {
      ...toPublicAfiliado(row),
      link: linkAfiliado(row.codigo, origin),
    },
    resumo: {
      clicks: clicks ?? 0,
      cadastros: cadastros ?? 0,
      clientes: empresas?.length ?? 0,
      pendente_centavos: pendente,
      pago_centavos: pago,
    },
    comissoes: comissoes ?? [],
    empresas: empresas ?? [],
  });
}
