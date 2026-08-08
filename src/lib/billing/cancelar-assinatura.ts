import type { SupabaseClient } from "@supabase/supabase-js";

export type ModoCancelamento = "fim_periodo" | "imediato";

/**
 * Cancela assinatura do cliente.
 * O MP não é recorrência automática — cada período é pago manualmente.
 * Mantém acesso até o vencimento quando modo = fim_periodo.
 */
export async function cancelarAssinaturaEmpresa(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    modo: ModoCancelamento;
    assinaturaVenceEm?: string | null;
  }
): Promise<{ ok: true; acesso_ate: string | null } | { ok: false; error: string }> {
  const now = new Date();
  const vence = opts.assinaturaVenceEm ? new Date(opts.assinaturaVenceEm) : null;
  const venceValido = vence && vence.getTime() > now.getTime();

  let acessoAte: string | null = null;

  if (opts.modo === "fim_periodo" && venceValido) {
    acessoAte = vence!.toISOString();
  } else {
    acessoAte = new Date(now.getTime() - 60_000).toISOString();
  }

  const profileUpdate = {
    assinatura_ativa: false,
    trial_fim: acessoAte,
  };

  const { error: profError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("empresa_id", opts.empresaId);

  if (profError) {
    return { ok: false, error: profError.message };
  }

  const empresaUpdate: Record<string, unknown> = {
    assinatura_vence_em: opts.modo === "imediato" ? null : opts.assinaturaVenceEm ?? null,
  };
  if (opts.modo === "imediato") {
    empresaUpdate.status = "suspenso";
  }

  const { error: empError } = await supabase
    .from("empresas")
    .update(empresaUpdate)
    .eq("id", opts.empresaId);

  if (empError && !String(empError.message).includes("assinatura_vence_em")) {
    return { ok: false, error: empError.message };
  }

  if (empError && String(empError.message).includes("assinatura_vence_em")) {
    const { error: empError2 } = await supabase
      .from("empresas")
      .update(
        opts.modo === "imediato" ? { status: "suspenso" } : {}
      )
      .eq("id", opts.empresaId);
    if (empError2) {
      return { ok: false, error: empError2.message };
    }
  }

  return {
    ok: true,
    acesso_ate: opts.modo === "fim_periodo" && venceValido ? acessoAte : null,
  };
}
