import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aplicarPlanoEmpresa,
  calcVencimentoAssinatura,
} from "@/lib/billing/aplicar-plano";
import type { Nicho } from "@/lib/types/database";
import type { PlanoDefinicao } from "@/lib/pricing";

export type CheckoutRow = {
  id: string;
  empresa_id: string;
  ciclo: "mensal" | "anual";
  faixa: string;
  nichos: Nicho[] | unknown;
  valor_centavos: number;
  plano_nome: string | null;
  status: string;
  mp_payment_id?: string | null;
};

/**
 * Confirma pagamento aprovado: aplica plano, ativa assinatura e registra receita.
 * Idempotente se o checkout já estiver `pago`.
 */
export async function ativarCheckoutPago(
  admin: SupabaseClient,
  opts: {
    checkout: CheckoutRow;
    paymentId: string;
    mpStatus?: string;
    metodo?: string;
    planos?: PlanoDefinicao[];
  }
): Promise<{ ok: true; already?: boolean } | { ok: false; error: string }> {
  const { checkout, paymentId } = opts;

  if (checkout.status === "pago") {
    return { ok: true, already: true };
  }

  const nichos = Array.isArray(checkout.nichos)
    ? (checkout.nichos as Nicho[])
    : [];

  const vence = calcVencimentoAssinatura(checkout.ciclo);

  const aplicado = await aplicarPlanoEmpresa(admin, {
    empresaId: checkout.empresa_id,
    nichos,
    quantidade_pontos: checkout.faixa,
    planos: opts.planos,
    ativarAssinatura: true,
    ciclo: checkout.ciclo,
    assinaturaVenceEm: vence,
  });

  if (!aplicado.ok) {
    return { ok: false, error: aplicado.error };
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("nome_operacao")
    .eq("id", checkout.empresa_id)
    .maybeSingle();

  const { error: payError } = await admin.from("plataforma_pagamentos").insert({
    empresa_id: checkout.empresa_id,
    empresa_nome: empresa?.nome_operacao ?? checkout.plano_nome,
    ciclo: checkout.ciclo,
    valor_centavos: checkout.valor_centavos,
    status: "pago",
    metodo: opts.metodo ?? "mercado_pago",
    referencia: String(paymentId),
    observacao: `MP payment ${paymentId} · checkout ${checkout.id}`,
    pago_em: new Date().toISOString(),
    checkout_id: checkout.id,
    created_by: "mercado_pago",
  });

  // Se coluna checkout_id não existir, tenta sem ela
  if (payError && String(payError.message).includes("checkout_id")) {
    const { error: payError2 } = await admin.from("plataforma_pagamentos").insert({
      empresa_id: checkout.empresa_id,
      empresa_nome: empresa?.nome_operacao ?? checkout.plano_nome,
      ciclo: checkout.ciclo,
      valor_centavos: checkout.valor_centavos,
      status: "pago",
      metodo: opts.metodo ?? "mercado_pago",
      referencia: String(paymentId),
      observacao: `MP payment ${paymentId} · checkout ${checkout.id}`,
      pago_em: new Date().toISOString(),
      created_by: "mercado_pago",
    });
    if (payError2) {
      // pagamento pode já existir (idempotência por referencia)
      if (!String(payError2.message).toLowerCase().includes("duplicate")) {
        return { ok: false, error: payError2.message };
      }
    }
  } else if (payError) {
    if (!String(payError.message).toLowerCase().includes("duplicate")) {
      // tabela pode não existir — assinatura já foi ativada; segue
      console.error("[billing] plataforma_pagamentos:", payError.message);
    }
  }

  const { error: updError } = await admin
    .from("plataforma_checkout")
    .update({
      status: "pago",
      mp_payment_id: String(paymentId),
      mp_status: opts.mpStatus ?? "approved",
      paid_at: new Date().toISOString(),
    })
    .eq("id", checkout.id);

  if (updError) {
    return { ok: false, error: updError.message };
  }

  return { ok: true };
}
