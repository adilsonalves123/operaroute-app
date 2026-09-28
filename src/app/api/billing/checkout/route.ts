import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createCheckoutPreference, isMercadoPagoConfigured } from "@/lib/billing/mp-client";
import { prepararCheckout, type CheckoutBody } from "@/lib/billing/preparar-checkout";

export async function POST(request: Request) {
  const auth = await requireAcesso("planos", "editar");
  if (!auth.ok) return auth.response;

  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      {
        error:
          "Mercado Pago não configurado. Defina MP_ACCESS_TOKEN no ambiente (Vercel / .env.local).",
      },
      { status: 503 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY necessária para checkout." },
      { status: 503 }
    );
  }

  const { profile } = auth;
  const empresaId = profile.empresa_id;
  if (!empresaId) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });
  }

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
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
    })
    .select("id")
    .single();

  if (checkoutError || !checkout) {
    const msg = checkoutError?.message ?? "Falha ao criar checkout.";
    const needsSql =
      msg.includes("plataforma_checkout") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist");
    return NextResponse.json(
      {
        error: needsSql
          ? "Rode supabase/mercado-pago-billing.sql no Supabase SQL Editor."
          : msg,
      },
      { status: 500 }
    );
  }

  const pref = await createCheckoutPreference({
    checkoutId: checkout.id,
    payerEmail: profile.email,
    items: [
      {
        title: titulo,
        quantity: 1,
        unit_price: valorCentavos / 100,
      },
    ],
    statementDescriptor: "OPERAROUT",
  });

  if (!pref.ok) {
    await admin
      .from("plataforma_checkout")
      .update({ status: "cancelado" })
      .eq("id", checkout.id);
    return NextResponse.json({ error: pref.message }, { status: pref.status || 502 });
  }

  await admin
    .from("plataforma_checkout")
    .update({
      mp_preference_id: pref.preference.id,
      init_point: pref.preference.init_point,
    })
    .eq("id", checkout.id);

  // Em sandbox com token TEST, preferir sandbox_init_point se existir
  const initPoint =
    process.env.MP_USE_SANDBOX === "1" && pref.preference.sandbox_init_point
      ? pref.preference.sandbox_init_point
      : pref.preference.init_point;

  return NextResponse.json({
    checkout_id: checkout.id,
    init_point: initPoint,
    valor,
    ciclo,
    plano: plano.nome,
  });
}
