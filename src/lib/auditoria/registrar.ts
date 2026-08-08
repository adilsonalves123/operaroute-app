import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditoriaCategoria,
  AuditoriaSeveridade,
} from "@/lib/auditoria/types";

export type RegistrarAuditoriaInput = {
  supabase: SupabaseClient;
  empresaId: string;
  userId?: string | null;
  userNome?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  acao: string;
  tabela: string;
  registroId?: string | null;
  dadosAnteriores?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  severidade?: AuditoriaSeveridade;
  categoria?: AuditoriaCategoria;
  modulo?: string | null;
  titulo: string;
  resumo?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown> | null;
};

/** Nunca quebra a operação principal — falhas de auditoria são silenciosas. */
export async function registrarAuditoria(
  input: RegistrarAuditoriaInput
): Promise<void> {
  try {
    const { error } = await input.supabase.from("auditoria").insert({
      empresa_id: input.empresaId,
      user_id: input.userId ?? null,
      acao: input.acao,
      tabela: input.tabela,
      registro_id: input.registroId ?? null,
      dados_anteriores: input.dadosAnteriores ?? null,
      dados_novos: input.dadosNovos ?? null,
      severidade: input.severidade ?? "info",
      categoria: input.categoria ?? "sistema",
      modulo: input.modulo ?? null,
      titulo: input.titulo,
      resumo: input.resumo ?? null,
      user_nome: input.userNome ?? null,
      user_email: input.userEmail ?? null,
      user_role: input.userRole ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      meta: input.meta ?? null,
    });
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[auditoria]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[auditoria]", e);
    }
  }
}

export function requestMeta(request?: Request | null): {
  ip: string | null;
  userAgent: string | null;
} {
  if (!request) return { ip: null, userAgent: null };
  const fwd = request.headers.get("x-forwarded-for");
  const ip =
    fwd?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent };
}

/** Diff superficial: só chaves que mudaram. */
export function diffCampos(
  antes: Record<string, unknown> | null | undefined,
  depois: Record<string, unknown> | null | undefined,
  campos?: string[]
): { anteriores: Record<string, unknown>; novos: Record<string, unknown>; mudou: string[] } {
  const a = antes ?? {};
  const b = depois ?? {};
  const keys = campos ?? Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const anteriores: Record<string, unknown> = {};
  const novos: Record<string, unknown> = {};
  const mudou: string[] = [];

  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    const same = JSON.stringify(va ?? null) === JSON.stringify(vb ?? null);
    if (!same) {
      mudou.push(k);
      anteriores[k] = va ?? null;
      novos[k] = vb ?? null;
    }
  }
  return { anteriores, novos, mudou };
}
