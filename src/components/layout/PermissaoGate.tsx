"use client";

import type { PermissaoAcao, PermissaoModulo } from "@/lib/equipe/permissions";
import { usePermissoes } from "@/components/layout/PermissoesProvider";

export function PermissaoGate({
  modulo,
  acao,
  children,
  fallback = null,
}: {
  modulo: PermissaoModulo;
  acao: PermissaoAcao;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { pode } = usePermissoes();
  if (!pode(modulo, acao)) return <>{fallback}</>;
  return <>{children}</>;
}
