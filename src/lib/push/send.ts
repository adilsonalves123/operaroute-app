import webpush from "web-push";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import {
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
  isPushConfigured,
} from "@/lib/push/vapid";
import {
  isFcmConfigured,
  isFcmEndpoint,
  sendFcmToToken,
  tokenFromFcmEndpoint,
} from "@/lib/push/fcm";
import type { PushPayload } from "@/lib/push/types";

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

function ensureVapid() {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
  return true;
}

async function sendToWebSubscription(
  sub: SubRow,
  payload: PushPayload
): Promise<"ok" | "gone" | "error"> {
  if (!sub.p256dh || !sub.auth) return "error";
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/dashboard",
        tag: payload.tag,
      }),
      { TTL: 60 * 60 * 12 }
    );
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push] web send failed", status, err);
    return "error";
  }
}

/**
 * Envia push (Web Push + FCM Android) para as subscriptions dos user_ids.
 * Usa service role. Nunca lança — falhas só logam.
 */
export async function sendPushToUserIds(
  empresaId: string,
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (!isAdminConfigured() || userIds.length === 0) return;

  const webOk = isPushConfigured() && ensureVapid();
  const fcmOk = isFcmConfigured();
  if (!webOk && !fcmOk) return;

  try {
    const admin = createAdminClient();
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("empresa_id", empresaId)
      .in("user_id", userIds);

    if (error || !subs?.length) return;

    const goneIds: string[] = [];
    await Promise.all(
      (subs as SubRow[]).map(async (sub) => {
        if (isFcmEndpoint(sub.endpoint)) {
          if (!fcmOk) return;
          const token = tokenFromFcmEndpoint(sub.endpoint);
          if (!token) return;
          const result = await sendFcmToToken(token, payload);
          if (result === "gone") goneIds.push(sub.id);
          return;
        }
        if (!webOk) return;
        const result = await sendToWebSubscription(sub, payload);
        if (result === "gone") goneIds.push(sub.id);
      })
    );

    if (goneIds.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", goneIds);
    }
  } catch (e) {
    console.error("[push] sendPushToUserIds", e);
  }
}
