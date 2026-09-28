import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createPreapproval, isMercadoPagoConfigured } from "@/lib/billing/mp-client";
import { prepararCheckout, type CheckoutBody } from "@/lib/billing/preparar-checkout";
import { erroFaltaMigracao, SQL_ASSINATURA_RECORRENTE } from "@/lib/billing/assinatura-recorrente";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Renovação automática no cartão (assinatura sem plano do Mercado Pago).
 * O cliente cadastra o cartão no init_point; as cobranças chegam pelo webhook.
 */
export async function POST(request: Request) {
  const auth = await requireAcesso("planos", "editar");
  if (!auth.ok) return auth.response;

  if (!isMercadoPagoConfigured() || !isAdminConfigured()) {
    return NextResponse.json(
      { error: "Mercado Pago ou SUPABASE_SERVICE_ROLE_KEY não configurados." },
      { status: 503 }
    );
  }

  const { profile, empresa } = auth;
  const empresaId = profile.empresa_id;

  let body: CheckoutBody & { payer_email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const payerEmail = String(body.payer_email ?? profile.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(payerEmail)) {
    return NextResponse.json(
      { error: "Informe o e-mail da sua conta Mercado Pago." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const preparado = await prepararCheckout(admin, empresaId, body);
  if (!preparado.ok) return preparado.response;
  const { ciclo, faixa, plano, pagos, valor, valorCentavos, titulo } = preparado.dados;

  const { data: checkout, error: checkoutError } = await admin
    .from("plataforma_checkout")
    .insert({
      empresa_id: empresaId,
      user_id: profile.user_id,
      ciclo,
      faixa,
      nichos: pagos,
      valor_centavos: valorCentavos,
      plano_nome: plano.nome,
      status: "pendente",
      tipo: "assinatura",
    })
    .select("id")
    .single();

  if (checkoutError || !checkout) {
    const msg = checkoutError?.message ?? "Falha ao criar assinatura.";
    return NextResponse.json(
      {
        error: erroFaltaMigracao(msg)
          ? `Renovação automática ainda não habilitada. Rode ${SQL_ASSINATURA_RECORRENTE} no Supabase.`
          : msg,
      },
      { status: 500 }
    );
  }

  // Ainda tem período pago: a primeira cobrança no cartão só acontece no vencimento.
  const venceAtual = empresa?.assinatura_vence_em ? new Date(empresa.assinatura_vence_em) : null;
  const inicioCobranca =
    venceAtual && venceAtual.getTime() > Date.now() ? venceAtual : null;

  const pre = await createPreapproval({
    checkoutId: checkout.id,
    reason: `${titulo} · renovação automática`,
    payerEmail,
    valor,
    frequenciaMeses: ciclo === "anual" ? 12 : 1,
    inicioCobranca,
  });

  if (!pre.ok) {
    await admin
      .from("plataforma_checkout")
      .update({ status: "cancelado" })
      .eq("id", checkout.id);
    return NextResponse.json({ error: pre.message }, { status: pre.status || 502 });
  }

  await admin
    .from("plataforma_checkout")
    .update({
      mp_preapproval_id: pre.preapproval.id,
      init_point: pre.preapproval.init_point,
      mp_status: pre.preapproval.status,
    })
    .eq("id", checkout.id);

  return NextResponse.json({
    checkout_id: checkout.id,
    init_point: pre.preapproval.init_point,
    valor,
    ciclo,
    plano: plano.nome,
    primeira_cobranca: inicioCobranca?.toISOString() ?? null,
  });
}
