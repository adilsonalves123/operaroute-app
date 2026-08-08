"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const COOKIE = "or_ref";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 dias

/** Captura ?ref= do afiliado e grava cookie + clique. */
export function AfiliadoRefCapture() {
  const search = useSearchParams();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const ref = search.get("ref")?.trim();
    if (!ref) {
      setDone(true);
      return;
    }
    document.cookie = `${COOKIE}=${encodeURIComponent(ref)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    void fetch("/api/afiliados/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: ref }),
    }).finally(() => setDone(true));
  }, [search, done]);

  return null;
}
