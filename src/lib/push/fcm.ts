/**
 * Firebase Admin (FCM) — env FIREBASE_SERVICE_ACCOUNT_JSON
 * (JSON completo da service account, em uma linha no Vercel).
 */

import type { PushPayload } from "@/lib/push/types";
import {
  fcmEndpointFromToken,
  isFcmEndpoint,
  tokenFromFcmEndpoint,
} from "@/lib/push/fcm-endpoint";

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

let initTried = false;
let messaging: import("firebase-admin/messaging").Messaging | null = null;

export function isFcmConfigured(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    return Boolean(parsed.project_id && parsed.client_email && parsed.private_key);
  } catch {
    return false;
  }
}

async function getMessaging() {
  if (messaging) return messaging;
  if (initTried) return null;
  initTried = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const { cert, getApps, initializeApp } = await import("firebase-admin/app");
    const { getMessaging: getMsg } = await import("firebase-admin/messaging");
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;

    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: sa.project_id,
          clientEmail: sa.client_email,
          privateKey: sa.private_key.replace(/\\n/g, "\n"),
        }),
      });

    messaging = getMsg(app);
    return messaging;
  } catch (e) {
    console.error("[push/fcm] init failed", e);
    return null;
  }
}

export { fcmEndpointFromToken, isFcmEndpoint, tokenFromFcmEndpoint };

/**
 * Envia notificação FCM data+notification.
 * Retorna gone se o token for inválido.
 */
export async function sendFcmToToken(
  token: string,
  payload: PushPayload
): Promise<"ok" | "gone" | "error"> {
  const msg = await getMessaging();
  if (!msg) return "error";

  const url = payload.url ?? "/dashboard";
  try {
    await msg.send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        title: payload.title,
        body: payload.body,
        url,
        tag: payload.tag ?? "",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "operaroute_alertas",
          sound: "default",
          tag: payload.tag,
        },
      },
    });
    return "ok";
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (
      code.includes("registration-token-not-registered") ||
      code.includes("invalid-registration-token") ||
      code.includes("messaging/registration-token-not-registered") ||
      code.includes("messaging/invalid-registration-token")
    ) {
      return "gone";
    }
    console.error("[push/fcm] send failed", code, err);
    return "error";
  }
}
