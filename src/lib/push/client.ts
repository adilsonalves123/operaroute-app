"use client";

import { Capacitor } from "@capacitor/core";
import { fcmEndpointFromToken } from "@/lib/push/fcm-endpoint";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isNativeAndroidApp(): boolean {
  if (typeof window === "undefined") return false;

  const w = window as Window & { androidBridge?: unknown };
  if (w.androidBridge) return true;

  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function pushSupported(): boolean {
  if (isNativeAndroidApp()) return true;
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
}

async function saveFcmToken(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: "android",
      fcm_token: token,
      user_agent: navigator.userAgent,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Erro ao salvar token Android." };
  }
  try {
    localStorage.setItem("or_fcm_token", token);
  } catch {
    /* ignore */
  }
  return { ok: true };
}

export async function subscribeNativePush(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!isNativeAndroidApp()) {
    return { ok: false, error: "Só disponível no app Android." };
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      return { ok: false, error: "Permissão de notificação negada." };
    }

    await PushNotifications.createChannel({
      id: "operaroute_alertas",
      name: "Alertas OperaRoute",
      description: "Coletas, manutenção e suporte",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
    });

    return await new Promise((resolve) => {
      let settled = false;
      const finish = (result: { ok: true } | { ok: false; error: string }) => {
        if (settled) return;
        settled = true;
        void PushNotifications.removeAllListeners();
        resolve(result);
      };

      const timer = window.setTimeout(() => {
        finish({
          ok: false,
          error:
            "Não veio token do Firebase. Confira se o google-services.json está no APK.",
        });
      }, 15000);

      void PushNotifications.addListener("registration", (token) => {
        window.clearTimeout(timer);
        void saveFcmToken(token.value).then(finish);
      });

      void PushNotifications.addListener("registrationError", (err) => {
        window.clearTimeout(timer);
        finish({
          ok: false,
          error: err.error || "Falha ao registrar push nativo.",
        });
      });

      void PushNotifications.register().catch((e: unknown) => {
        window.clearTimeout(timer);
        finish({
          ok: false,
          error: e instanceof Error ? e.message : "Erro ao registrar push.",
        });
      });
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Plugin de push indisponível.",
    };
  }
}

export async function subscribeWebPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isNativeAndroidApp()) {
    return subscribeNativePush();
  }

  if (!pushSupported()) {
    return { ok: false, error: "Este navegador não suporta notificações push." };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, error: "Permissão de notificação negada." };
  }

  const keyRes = await fetch("/api/push/vapid-public", { credentials: "include" });
  const keyData = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !keyData.publicKey) {
    return {
      ok: false,
      error: keyData.error ?? "Push não configurado no servidor (chaves VAPID).",
    };
  }

  const reg = await registerPushServiceWorker();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
    });
  }

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Erro ao salvar inscrição." };
  }
  return { ok: true };
}

export async function unsubscribeWebPush(): Promise<void> {
  if (isNativeAndroidApp()) {
    let token: string | null = null;
    try {
      token = localStorage.getItem("or_fcm_token");
    } catch {
      /* ignore */
    }
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { fcm_token: token } : {}),
    });
    try {
      localStorage.removeItem("or_fcm_token");
    } catch {
      /* ignore */
    }
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.removeAllListeners();
    } catch {
      /* ignore */
    }
    return;
  }

  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  const endpoint = sub?.endpoint;
  if (sub) await sub.unsubscribe();
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

/** Mantém listeners de abertura de notificação no app nativo. */
export async function attachNativePushListeners(): Promise<void> {
  if (!isNativeAndroidApp()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const url = event.notification.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        window.location.assign(url);
      }
    });

    await PushNotifications.addListener("registration", (token) => {
      void saveFcmToken(token.value);
    });
  } catch {
    /* plugin ausente */
  }
}
