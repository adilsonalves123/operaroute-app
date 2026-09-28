"use client";

import { usePathname } from "next/navigation";
import { TrialExpiradoGate } from "./TrialExpiradoGate";

export function TrialAccessBody({
  bloqueado,
  assinaturaVencida = false,
  children,
}: {
  bloqueado: boolean;
  assinaturaVencida?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const liberado =
    pathname.startsWith("/planos") || pathname.startsWith("/suporte");
  if (bloqueado && !liberado) {
    return <TrialExpiradoGate assinaturaVencida={assinaturaVencida} />;
  }
  return <>{children}</>;
}
