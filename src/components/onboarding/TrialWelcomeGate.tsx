"use client";

import { useEffect, useState } from "react";
import { TrialGratisCard } from "@/components/onboarding/TrialGratisCard";
import type { TrialResumo } from "@/lib/onboarding/trial-resumo";

/** Mostra o card de 7 dias grátis uma vez após o onboarding. */
export function TrialWelcomeGate({ resumo }: { resumo: TrialResumo }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const fromStorage = sessionStorage.getItem("or_trial_welcome") === "1";
      const fromQuery =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("bemvindo") === "1";
      if (fromStorage || fromQuery) {
        setShow(true);
        sessionStorage.removeItem("or_trial_welcome");
        if (fromQuery) {
          const url = new URL(window.location.href);
          url.searchParams.delete("bemvindo");
          window.history.replaceState({}, "", url.pathname + url.search);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  if (!show) return null;
  return <TrialGratisCard resumo={resumo} className="mb-6" />;
}
