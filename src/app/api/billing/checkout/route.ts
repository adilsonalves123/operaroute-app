import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { loadPrecosPayload } from "@/lib/dono/precos";
import {
  calcPrecoCiclo,
  getPlanoByFaixa,
  NICHOS_PAGOS,
  normalizeFaixaPontos,
  PLANOS_PADRAO,
  type FaixaPontos,
} from "@/lib/pricing";
import { createCheckoutPreference, isMercadoPagoConfigured } from "@/lib/billing/mp-client";
import type { Nicho } from "@/lib/types/database";
import {
  loadNichosPagosAtivos,
  mensagemNichosTravados,
  nichosRemovidosIndevidamente,
} from "@/lib/nichos/nicho-travado";

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

  let body: {
    nichos?: Nicho[];
    quantidade_pontos?: FaixaPontos | string;
    ciclo?: "mensal" | "anual";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const ciclo = body.ciclo === "anual" ? "anual" : "mensal";
  const admin = createAdminClient();
  const precos = await loadPrecosPayload(admin);
  const planos = precos.planos?.length ? precos.planos : PLANOS_PADRAO;
  const multAnual = precos.multiplicador_anual;

  const pagos = (body.nichos ?? []).filter((n) => NICHOS_PAGOS.includes(n));
  if (pagos.length === 0) {
    return NextResponse.json(
      { error: "Selecione pelo menos um nicho." },
      { status: 400 }
    );
  }

  const nichosJaAtivos = await loadNichosPagosAtivos(admin, empresaId);
  const removidos = nichosRemovidosIndevidamente(nichosJaAtivos, pagos);
  if (removidos.length > 0) {
    return NextResponse.json(
      { error: mensagemNichosTravados(removidos), code: "nicho_travado" },
      { status: 403 }
    );
  }

  const faixa = normalizeFaixaPontos(body.quantidade_pontos);
  const plano = getPlanoByFaixa(faixa, planos);
  if (pagos.length > plano.maxNichos) {
    return NextResponse.json(
      {
        error: `O plano ${plano.nome} permite no máximo ${plano.maxNichos} nicho(s).`,
      },
      { status: 403 }
    );
  }

  const valor = calcPrecoCiclo(ciclo, faixa, pagos, planos, multAnual);
  if (valor == null || valor <= 0) {
    return NextResponse.json({ error: "Preço indisponível para este plano." }, { status: 400 });
  }

  const valorCentavos = Math.round(valor * 100);
  const titulo =
    ciclo === "anual"
      ? `OperaRoute ${plano.nome} — anual`
      : `OperaRoute ${plano.nome} — mensal`;

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
