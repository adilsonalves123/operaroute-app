import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isFcmConfigured } from "@/lib/push/fcm";
import { sendPushToUserIds } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/push/vapid";
import type { PushPayload } from "@/lib/push/types";

function pushEnvioDisponivel(): boolean {
  return isPushConfigured() || isFcmConfigured();
}

/**
 * Notifica dono + admin + gerente da empresa (exceto o próprio autor, se informado).
 * Fire-and-forget seguro: não falha a request principal.
 */
export async function notifyEmpresaAdmins(
  empresaId: string,
  payload: PushPayload,
  opts?: { excludeUserId?: string | null }
): Promise<void> {
  if (!empresaId || !isAdminConfigured() || !pushEnvioDisponivel()) return;

  try {
    const admin = createAdminClient();

    const { data: empresa } = await admin
      .from("empresas")
      .select("owner_id")
      .eq("id", empresaId)
      .maybeSingle();

    const { data: equipe } = await admin
      .from("equipe")
      .select("user_id, role")
      .eq("empresa_id", empresaId)
      .in("role", ["admin", "gerente"]);

    const ids = new Set<string>();
    if (empresa?.owner_id) ids.add(String(empresa.owner_id));
    for (const row of equipe ?? []) {
      if (row.user_id) ids.add(String(row.user_id));
    }

    if (opts?.excludeUserId) ids.delete(opts.excludeUserId);
    if (ids.size === 0) return;

    await sendPushToUserIds(empresaId, [...ids], payload);
  } catch (e) {
    console.error("[push] notifyEmpresaAdmins", e);
  }
}

/** Atalho: não espera o envio (não atrasa a API). */
export function notifyEmpresaAdminsBackground(
  empresaId: string,
  payload: PushPayload,
  opts?: { excludeUserId?: string | null }
): void {
  void notifyEmpresaAdmins(empresaId, payload, opts);
}
