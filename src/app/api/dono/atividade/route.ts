import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const url = new URL(request.url);
  const limit = Math.min(80, Math.max(10, Number(url.searchParams.get("limit")) || 40));

  const admin = createAdminClient();
  const desde24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const desde7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let sessoes: Record<string, unknown>[] = [];
  let eventos: Record<string, unknown>[] = [];
  let sessoes24 = 0;
  let sessoes7 = 0;

  const [sRes, s24, s7, eRes] = await Promise.all([
    admin
      .from("auditoria_sessoes")
      .select(
        "id, user_nome, user_email, empresa_id, iniciado_em, ultimo_ping, dispositivo, ip"
      )
      .order("iniciado_em", { ascending: false })
      .limit(limit),
    admin
      .from("auditoria_sessoes")
      .select("id", { count: "exact", head: true })
      .gte("iniciado_em", desde24),
    admin
      .from("auditoria_sessoes")
      .select("id", { count: "exact", head: true })
      .gte("iniciado_em", desde7),
    admin
      .from("auditoria")
      .select(
        "id, empresa_id, user_nome, acao, titulo, severidade, created_at, modulo"
      )
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (!sRes.error) sessoes = (sRes.data as Record<string, unknown>[]) ?? [];
  if (!s24.error) sessoes24 = s24.count ?? 0;
  if (!s7.error) sessoes7 = s7.count ?? 0;
  if (!eRes.error) eventos = (eRes.data as Record<string, unknown>[]) ?? [];

  const empresaIds = [
    ...new Set(
      [...sessoes, ...eventos]
        .map((r) => r.empresa_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const nomes = new Map<string, string>();
  if (empresaIds.length) {
    const { data: empresas } = await admin
      .from("empresas")
      .select("id, nome_operacao")
      .in("id", empresaIds);
    for (const e of empresas ?? []) nomes.set(e.id, e.nome_operacao);
  }

  return NextResponse.json({
    resumo: {
      sessoes_24h: sessoes24,
      sessoes_7d: sessoes7,
    },
    sessoes: sessoes.map((s) => ({
      ...s,
      empresa_nome: s.empresa_id
        ? nomes.get(String(s.empresa_id)) ?? null
        : null,
    })),
    eventos: eventos.map((e) => ({
      ...e,
      empresa_nome: e.empresa_id
        ? nomes.get(String(e.empresa_id)) ?? null
        : null,
    })),
  });
}
