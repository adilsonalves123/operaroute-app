import type { SupabaseClient } from "@supabase/supabase-js";
import { ativarCheckoutPago, type CheckoutRow } from "@/lib/billing/ativar-pagamento";
import {
  cancelPreapproval,
  fetchAuthorizedPayment,
  fetchPreapproval,
} from "@/lib/billing/mp-client";
import type { PlanoDefinicao } from "@/lib/pricing";

export const SQL_ASSINATURA_RECORRENTE = "supabase/mercado-pago-assinatura-recorrente.sql";

const CHECKOUT_COLUMNS =
  "id, empresa_id, user_id, ciclo, faixa, nichos, valor_centavos, plano_nome, status, mp_payment_id, tipo, mp_preapproval_id";

type CheckoutAssinaturaRow = CheckoutRow & {
  user_id?: string | null;
  tipo?: string | null;
  mp_preapproval_id?: string | null;
};

export function erroFaltaMigracao(message: string | undefined | null): boolean {
  const msg = String(message ?? "");
  return (
    /tipo|mp_preapproval_id|renovacao_automatica/.test(msg) &&
    /column|schema cache|does not exist/i.test(msg)
  );
}

export type RenovacaoAutomatica = {
  ativa: boolean;
  preapprovalId: string | null;
};

/** Lê se a empresa tem recorrência no cartão. Sem a migration, assume desligada. */
export async function carregarRenovacaoAutomatica(
  admin: SupabaseClient,
  empresaId: string
): Promise<RenovacaoAutomatica> {
  const { data, error } = await admin
    .from("empresas")
    .select("renovacao_automatica, mp_preapproval_id")
    .eq("id", empresaId)
    .maybeSingle();
  if (error || !data) return { ativa: false, preapprovalId: null };
  return {
    ativa: Boolean(data.renovacao_automatica),
    preapprovalId: data.mp_preapproval_id ? String(data.mp_preapproval_id) : null,
  };
}

async function buscarModeloAssinatura(
  admin: SupabaseClient,
  opts: { checkoutId?: string | null; preapprovalId?: string | null }
): Promise<CheckoutAssinaturaRow | null> {
  if (opts.checkoutId) {
    const { data } = await admin
      .from("plataforma_checkout")
      .select(CHECKOUT_COLUMNS)
      .eq("id", opts.checkoutId)
      .eq("tipo", "assinatura")
      .maybeSingle();
    if (data) return data as CheckoutAssinaturaRow;
  }
  if (opts.preapprovalId) {
    const { data } = await admin
      .from("plataforma_checkout")
      .select(CHECKOUT_COLUMNS)
      .eq("mp_preapproval_id", opts.preapprovalId)
      .eq("tipo", "assinatura")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as CheckoutAssinaturaRow;
  }
  return null;
}

/** Checkout do tipo "assinatura" (modelo da recorrência) — usado pelo webhook de payment. */
export async function ehModeloAssinatura(
  admin: SupabaseClient,
  checkoutId: string
): Promise<CheckoutAssinaturaRow | null> {
  return buscarModeloAssinatura(admin, { checkoutId });
}

/**
 * Cada cobrança aprovada da recorrência vira uma linha própria (assinatura_cobranca),
 * com o id do pagamento único — webhook repetido não estende duas vezes.
 */
export async function registrarCobrancaAssinatura(
  admin: SupabaseClient,
  opts: {
    modelo: CheckoutAssinaturaRow;
    preapprovalId: string;
    paymentId: string;
    valorCentavos?: number | null;
    metodo?: string;
    planos?: PlanoDefinicao[];
  }
): Promise<{ ok: true; already?: boolean } | { ok: false; error: string }> {
  const { modelo, preapprovalId, paymentId } = opts;

  const { data: existente } = await admin
    .from("plataforma_checkout")
    .select("id, status")
    .eq("mp_payment_id", paymentId)
    .maybeSingle();
  if (existente?.status === "pago") return { ok: true, already: true };

  const { count: cobrancasAnteriores } = await admin
    .from("plataforma_checkout")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "assinatura_cobranca")
    .eq("mp_preapproval_id", preapprovalId)
    .eq("status", "pago");

  let cobranca: CheckoutAssinaturaRow | null = null;
  if (existente) {
    const { data } = await admin
      .from("plataforma_checkout")
      .select(CHECKOUT_COLUMNS)
      .eq("id", existente.id)
      .maybeSingle();
    cobranca = (data as CheckoutAssinaturaRow) ?? null;
  } else {
    const { data, error } = await admin
      .from("plataforma_checkout")
      .insert({
        empresa_id: modelo.empresa_id,
        user_id: modelo.user_id ?? null,
        ciclo: modelo.ciclo,
        faixa: modelo.faixa,
        nichos: modelo.nichos,
        valor_centavos:
          opts.valorCentavos && opts.valorCentavos > 0
            ? opts.valorCentavos
            : modelo.valor_centavos,
        plano_nome: modelo.plano_nome,
        status: "pendente",
        tipo: "assinatura_cobranca",
        mp_preapproval_id: preapprovalId,
        mp_payment_id: paymentId,
      })
      .select(CHECKOUT_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") return { ok: true, already: true };
      return { ok: false, error: error.message };
    }
    cobranca = data as CheckoutAssinaturaRow;
  }

  if (!cobranca) return { ok: false, error: "Cobrança da assinatura não encontrada." };

  return ativarCheckoutPago(admin, {
    checkout: cobranca,
    paymentId,
    metodo: opts.metodo ?? "mercado_pago:assinatura",
    planos: opts.planos,
    somenteEstender: (cobrancasAnteriores ?? 0) > 0,
  });
}

/** Webhook subscription_preapproval: cartão cadastrado, pausado ou cancelado. */
export async function processarPreapproval(admin: SupabaseClient, preapprovalId: string) {
  const res = await fetchPreapproval(preapprovalId);
  if (!res.ok) return { ok: false as const, error: res.message };
  const pre = res.preapproval;

  const modelo = await buscarModeloAssinatura(admin, {
    checkoutId: pre.external_reference,
    preapprovalId: pre.id,
  });
  if (!modelo) return { ok: false as const, error: "Assinatura sem checkout correspondente." };

  await admin
    .from("plataforma_checkout")
    .update({ mp_preapproval_id: pre.id, mp_status: pre.status })
    .eq("id", modelo.id);

  const atual = await carregarRenovacaoAutomatica(admin, modelo.empresa_id);

  if (pre.status === "authorized") {
    // Trocou de plano no cartão: a recorrência antiga para de cobrar.
    if (atual.preapprovalId && atual.preapprovalId !== pre.id && atual.ativa) {
      await cancelPreapproval(atual.preapprovalId);
    }
    await admin
      .from("empresas")
      .update({ renovacao_automatica: true, mp_preapproval_id: pre.id })
      .eq("id", modelo.empresa_id);
    await admin
      .from("profiles")
      .update({ assinatura_ativa: true })
      .eq("empresa_id", modelo.empresa_id);
    return { ok: true as const, status: pre.status };
  }

  if (
    (pre.status === "cancelled" || pre.status === "paused") &&
    atual.preapprovalId === pre.id
  ) {
    await admin
      .from("empresas")
      .update({ renovacao_automatica: false })
      .eq("id", modelo.empresa_id);
  }

  return { ok: true as const, status: pre.status };
}

/** Webhook subscription_authorized_payment: fatura da recorrência cobrada. */
export async function processarAuthorizedPayment(
  admin: SupabaseClient,
  authorizedId: string,
  planos?: PlanoDefinicao[]
) {
  const res = await fetchAuthorizedPayment(authorizedId);
  if (!res.ok) return { ok: false as const, error: res.message };
  const fatura = res.authorized;

  const paymentId = fatura.payment?.id != null ? String(fatura.payment.id) : null;
  if (!paymentId || fatura.payment?.status !== "approved") {
    return { ok: true as const, skipped: true as const, status: fatura.payment?.status ?? fatura.status };
  }
  if (!fatura.preapproval_id) {
    return { ok: false as const, error: "Fatura sem preapproval_id." };
  }

  const modelo = await buscarModeloAssinatura(admin, {
    checkoutId: fatura.external_reference ? String(fatura.external_reference) : null,
    preapprovalId: fatura.preapproval_id,
  });
  if (!modelo) return { ok: false as const, error: "Fatura sem checkout correspondente." };

  const valor = Number(fatura.transaction_amount);
  return registrarCobrancaAssinatura(admin, {
    modelo,
    preapprovalId: fatura.preapproval_id,
    paymentId,
    valorCentavos: Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null,
    planos,
  });
}

/** Cancela a recorrência no MP e desliga a flag. Sem recorrência ativa, não faz nada. */
export async function cancelarRenovacaoAutomatica(
  admin: SupabaseClient,
  empresaId: string
): Promise<{ ok: true; cancelou: boolean } | { ok: false; error: string }> {
  const atual = await carregarRenovacaoAutomatica(admin, empresaId);
  if (!atual.ativa || !atual.preapprovalId) return { ok: true, cancelou: false };

  const res = await cancelPreapproval(atual.preapprovalId);
  if (!res.ok) {
    return {
      ok: false,
      error: `Não foi possível cancelar a cobrança no cartão (${res.message}). Tente de novo ou fale com o suporte.`,
    };
  }

  await admin
    .from("empresas")
    .update({ renovacao_automatica: false })
    .eq("id", empresaId);
  return { ok: true, cancelou: true };
}
