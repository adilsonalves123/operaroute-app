import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { canManageEquipe } from "@/lib/equipe/permissoes";
import {
  limparMidiaAntigaEmpresa,
  normalizarRetencaoMidiaDias,
  removerArquivoPorUrl,
} from "@/lib/relatorios/retencao";

async function gateGerir() {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return { ok: false as const, res: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const pode = await canManageEquipe(supabase, profile, empresa?.owner_id);
  if (!pode) {
    return { ok: false as const, res: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  }
  return { ok: true as const, profile, supabase, empresa };
}

/** Salva preferência de retenção (30/60/90/180/0). */
export async function PATCH(request: Request) {
  const gate = await gateGerir();
  if (!gate.ok) return gate.res;

  const body = await request.json().catch(() => ({}));
  const dias = normalizarRetencaoMidiaDias(body.retencao_midia_dias);

  let { error } = await gate.supabase
    .from("empresas")
    .update({ retencao_midia_dias: dias })
    .eq("id", gate.profile.empresa_id!);

  if (error && isAdminConfigured()) {
    const admin = createAdminClient();
    const r = await admin
      .from("empresas")
      .update({ retencao_midia_dias: dias })
      .eq("id", gate.profile.empresa_id!);
    error = r.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, retencao_midia_dias: dias });
}

/** Limpa agora com a retenção configurada. */
export async function POST(request: Request) {
  const gate = await gateGerir();
  if (!gate.ok) return gate.res;

  const body = await request.json().catch(() => ({}));
  const diasConfig = normalizarRetencaoMidiaDias(
    body.dias ?? gate.empresa?.retencao_midia_dias ?? 90
  );

  if (diasConfig === 0 && !body.forcar) {
    return NextResponse.json({
      ok: true,
      pulou: true,
      message: "Retenção em «Nunca». Nada foi apagado automaticamente.",
    });
  }

  const diasEfetivos =
    diasConfig === 0 && body.forcar
      ? normalizarRetencaoMidiaDias(body.forcar_dias ?? 90) || 90
      : diasConfig;

  const result = await limparMidiaAntigaEmpresa(
    gate.supabase,
    gate.profile.empresa_id!,
    diasEfetivos === 0 ? 90 : diasEfetivos
  );

  return NextResponse.json({ ok: true, ...result });
}

/** Apaga uma mídia específica (relatório ou foto de coleta). */
export async function DELETE(request: Request) {
  const gate = await gateGerir();
  if (!gate.ok) return gate.res;

  const body = await request.json().catch(() => ({}));
  const tipo = body.tipo as string;
  const id = String(body.id ?? "");

  if (!id || (tipo !== "relatorio" && tipo !== "coleta")) {
    return NextResponse.json(
      { error: "Informe tipo (relatorio|coleta) e id." },
      { status: 400 }
    );
  }

  if (tipo === "relatorio") {
    const { data: row, error } = await gate.supabase
      .from("relatorios_coleta")
      .select("id, foto_url, visita_id")
      .eq("id", id)
      .eq("empresa_id", gate.profile.empresa_id!)
      .maybeSingle();
    if (error || !row) {
      return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
    }
    await removerArquivoPorUrl(gate.supabase, row.foto_url);
    if (row.visita_id) {
      await gate.supabase
        .from("visitas")
        .update({ relatorio_url: null })
        .eq("id", row.visita_id)
        .eq("empresa_id", gate.profile.empresa_id!);
    }
    const { error: delErr } = await gate.supabase
      .from("relatorios_coleta")
      .delete()
      .eq("id", id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { data: coleta, error: cErr } = await gate.supabase
    .from("coletas")
    .select("id, foto_url")
    .eq("id", id)
    .eq("empresa_id", gate.profile.empresa_id!)
    .maybeSingle();
  if (cErr || !coleta) {
    return NextResponse.json({ error: "Coleta não encontrada." }, { status: 404 });
  }
  await removerArquivoPorUrl(gate.supabase, coleta.foto_url);
  const { error: upErr } = await gate.supabase
    .from("coletas")
    .update({ foto_url: null })
    .eq("id", id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
