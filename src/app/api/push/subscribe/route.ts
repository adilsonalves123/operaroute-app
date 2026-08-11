import { NextResponse } from "next/server";
import { createClient, getEmpresa, getProfile } from "@/lib/supabase/server";
import { getAcessoUsuario } from "@/lib/equipe/acesso";
import { isPushConfigured } from "@/lib/push/vapid";
import { fcmEndpointFromToken, isFcmConfigured } from "@/lib/push/fcm";

function podeReceberPush(role: string | undefined, isOwner: boolean): boolean {
  if (isOwner) return true;
  return role === "admin" || role === "gerente";
}

function pushConfiguredAny(): boolean {
  return isPushConfigured() || isFcmConfigured();
}

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id || !profile.user_id) {
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

  // Capacitor / Android FCM — salva token mesmo antes da service account (envio exige depois)
  if (platform === "android" || fcmToken) {
    if (!fcmToken || fcmToken.length < 20) {
      return NextResponse.json({ error: "Token FCM inválido." }, { status: 400 });
    }

    const endpoint = fcmEndpointFromToken(fcmToken);
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        empresa_id: profile.empresa_id,
        user_id: profile.user_id,
        endpoint,
        p256dh: "fcm",
        auth: "fcm",
        user_agent: userAgent ? `android|${userAgent}` : "android",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message.includes("push_subscriptions") || error.code === "42P01"
              ? "Tabela push_subscriptions não existe. Rode o SQL supabase/push-subscriptions.sql no Supabase."
              : error.message,
        },
        { status: 500 }
      );
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

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      empresa_id: profile.empresa_id,
      user_id: profile.user_id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message.includes("push_subscriptions") || error.code === "42P01"
            ? "Tabela push_subscriptions não existe. Rode o SQL supabase/push-subscriptions.sql no Supabase."
            : error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, platform: "web" });
}

export async function DELETE(request: Request) {
  const profile = await getProfile();
  if (!profile?.user_id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const fcmToken =
    typeof body.fcm_token === "string" ? body.fcm_token.trim() : "";
  const supabase = await createClient();

  if (fcmToken) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", profile.user_id)
      .eq("endpoint", fcmEndpointFromToken(fcmToken));
  } else if (endpoint) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", profile.user_id)
      .eq("endpoint", endpoint);
  } else {
    await supabase.from("push_subscriptions").delete().eq("user_id", profile.user_id);
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const profile = await getProfile();
  if (!profile?.user_id || !profile.empresa_id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const supabase = await createClient();
  const empresa = await getEmpresa(profile.empresa_id);
  const acesso = await getAcessoUsuario(supabase, profile, empresa?.owner_id);
  const allowed = podeReceberPush(acesso?.role, Boolean(acesso?.isOwner));

  const { count } = await supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.user_id);

  return NextResponse.json({
    configured: pushConfiguredAny(),
    webConfigured: isPushConfigured(),
    fcmConfigured: isFcmConfigured(),
    allowed,
    subscribed: (count ?? 0) > 0,
    count: count ?? 0,
  });
}
