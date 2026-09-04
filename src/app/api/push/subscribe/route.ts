import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile, getSession } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { isPushConfigured } from "@/lib/push/vapid";
import { fcmEndpointFromToken, isFcmConfigured } from "@/lib/push/fcm";

function isMissingPushSubscriptionsTable(message: string, code?: string): boolean {
  if (code === "42P01") return true;
  return (
    /could not find the table/i.test(message) ||
    /relation ["']?public\.?push_subscriptions["']? does not exist/i.test(message) ||
    (/push_subscriptions/i.test(message) && /schema cache/i.test(message)) ||
    (/PGRST205/i.test(message) && /push_subscriptions/i.test(message))
  );
}

function pushSubscribeErrorMessage(error: { message?: string; code?: string }): string {
  const detail = error.message || error.code || "erro desconhecido";
  if (isMissingPushSubscriptionsTable(detail, error.code)) {
    return (
      "Tabela push_subscriptions não encontrada (ou cache do Supabase desatualizado). " +
      "No Supabase → SQL Editor, rode supabase/push-subscriptions.sql (inclui NOTIFY no final). " +
      "Se já rodou, execute só: NOTIFY pgrst, 'reload schema';"
    );
  }
  return detail;
}

function podeReceberPush(role: string | undefined, isOwner: boolean): boolean {
  if (isOwner) return true;
  return role === "admin" || role === "gerente";
}

function pushConfiguredAny(): boolean {
  return isPushConfigured() || isFcmConfigured();
}

type PushSubscriptionRow = {
  empresa_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  updated_at: string;
};

/** Grava inscrição com service role (auth já validada na rota) — evita falso erro no app Android. */
async function upsertPushSubscription(row: PushSubscriptionRow) {
  if (isAdminConfigured()) {
    const admin = createAdminClient();
    return admin.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  }
  const supabase = await createClient();
  return supabase.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
}

async function deletePushSubscriptions(userId: string, endpoint?: string) {
  if (isAdminConfigured()) {
    const admin = createAdminClient();
    let q = admin.from("push_subscriptions").delete().eq("user_id", userId);
    if (endpoint) q = q.eq("endpoint", endpoint);
    return q;
  }
  const supabase = await createClient();
  let q = supabase.from("push_subscriptions").delete().eq("user_id", userId);
  if (endpoint) q = q.eq("endpoint", endpoint);
  return q;
}

async function countPushSubscriptions(userId: string) {
  if (isAdminConfigured()) {
    const admin = createAdminClient();
    return admin
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
  }
  const supabase = await createClient();
  return supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
}

export async function POST(request: Request) {
  const profile = await getProfile();
  const user = await getSession();
  if (!profile?.empresa_id || !user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);

  if (!podeReceberPush(acesso?.role, Boolean(acesso?.isOwner))) {
    return NextResponse.json(
      { error: "Somente admin, gerente ou dono podem ativar alertas push." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const platform = typeof body.platform === "string" ? body.platform : "web";
  const fcmToken =
    typeof body.fcm_token === "string" ? body.fcm_token.trim() : "";

  const userAgent =
    typeof body.user_agent === "string"
      ? body.user_agent.slice(0, 300)
      : request.headers.get("user-agent")?.slice(0, 300) ?? null;

  const baseRow = {
    empresa_id: profile.empresa_id,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  // Capacitor / Android FCM — salva token mesmo antes da service account (envio exige depois)
  if (platform === "android" || fcmToken) {
    if (!fcmToken || fcmToken.length < 20) {
      return NextResponse.json({ error: "Token FCM inválido." }, { status: 400 });
    }

    const endpoint = fcmEndpointFromToken(fcmToken);
    const { error } = await upsertPushSubscription({
      ...baseRow,
      endpoint,
      p256dh: "fcm",
      auth: "fcm",
      user_agent: userAgent ? `android|${userAgent}` : "android",
    });

    if (error) {
      return NextResponse.json({ error: pushSubscribeErrorMessage(error) }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      platform: "android",
      fcmConfigured: isFcmConfigured(),
    });
  }

  // Web Push (VAPID)
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Web Push não configurado." }, { status: 503 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Subscription inválida." }, { status: 400 });
  }

  const { error } = await upsertPushSubscription({
    ...baseRow,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: pushSubscribeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true, platform: "web" });
}

export async function DELETE(request: Request) {
  const user = await getSession();
  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const fcmToken =
    typeof body.fcm_token === "string" ? body.fcm_token.trim() : "";

  if (fcmToken) {
    await deletePushSubscriptions(user.id, fcmEndpointFromToken(fcmToken));
  } else if (endpoint) {
    await deletePushSubscriptions(user.id, endpoint);
  } else {
    await deletePushSubscriptions(user.id);
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const profile = await getProfile();
  const user = await getSession();
  if (!user?.id || !profile?.empresa_id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  const allowed = podeReceberPush(acesso?.role, Boolean(acesso?.isOwner));

  const { count } = await countPushSubscriptions(user.id);

  return NextResponse.json({
    configured: pushConfiguredAny(),
    webConfigured: isPushConfigured(),
    fcmConfigured: isFcmConfigured(),
    allowed,
    subscribed: (count ?? 0) > 0,
    count: count ?? 0,
  });
}
