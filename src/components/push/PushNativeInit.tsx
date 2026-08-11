"use client";

import { useEffect } from "react";
import { attachNativePushListeners, isNativeAndroidApp } from "@/lib/push/client";

/** Listeners FCM no shell autenticado (só Capacitor Android). */
export function PushNativeInit() {
  useEffect(() => {
    if (!isNativeAndroidApp()) return;
    void attachNativePushListeners();
  }, []);
  return null;
}
