import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import type { AuditoriaCategoria, AuditoriaSeveridade } from "@/lib/auditoria/types";

export async function GET(request: Request) {
  const auth = await requireAcesso("auditoria", "ver");
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth;
  const url = new URL(request.url);

  const severidade = url.searchParams.get("severidade");
  const categoria = url.searchParams.get("categoria");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const userId = url.searchParams.get("user_id");
  const desde = url.searchParams.get("desde");
  const ate = url.searchParams.get("ate");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 80) || 80, 200);

  let query = supabase
    .from("auditoria")
    .select("*")
    .eq("empresa_id", profile.empresa_id!)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (severidade && severidade !== "todos") {
    query = query.eq("severidade", severidade as AuditoriaSeveridade);
  }
  if (categoria && categoria !== "todos") {
    query = query.eq("categoria", categoria as AuditoriaCategoria);
  }
  if (userId) query = query.eq("user_id", userId);
  if (desde) query = query.gte("created_at", desde);
  if (ate) query = query.lte("created_at", ate);
  if (q) {
    query = query.or(
      `titulo.ilike.%${q}%,resumo.ilike.%${q}%,user_nome.ilike.%${q}%,acao.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      {
        error:
          error.message.includes("severidade") || error.message.includes("column")
            ? "Rode supabase/auditoria-elaborada.sql no Supabase."
            : error.message,
      },
      { status: 500 }
    );
  }

  // Resumo 7 dias
  const desde7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentes } = await supabase
    .from("auditoria")
    .select("severidade, categoria, user_id")
    .eq("empresa_id", profile.empresa_id!)
    .gte("created_at", desde7);

  const stats = {
    total7d: recentes?.length ?? 0,
    critical: recentes?.filter((r) => r.severidade === "critical").length ?? 0,
    high: recentes?.filter((r) => r.severidade === "high").length ?? 0,
    sessoes: recentes?.filter((r) => r.categoria === "sessao").length ?? 0,
    anomalias:
      recentes?.filter(
        (r) => r.categoria === "anomalia" || r.severidade === "critical"
      ).length ?? 0,
  };

  return NextResponse.json({ eventos: data ?? [], stats });
}
