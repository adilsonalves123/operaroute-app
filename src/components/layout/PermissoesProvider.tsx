"use client";

import { createContext, useContext } from "react";
import type { PermissaoAcao, PermissaoModulo, PermissoesResolvidas } from "@/lib/equipe/permissions";
import { pode, podeVer } from "@/lib/equipe/permissions";
import type { UserRole } from "@/lib/types/database";

type PermissoesContextValue = {
  role: UserRole;
  isOwner: boolean;
  permissoes: PermissoesResolvidas;
  /** % da Equipe sobre lucro após brindes. */
  comissaoPercentual: number;
  pode: (modulo: PermissaoModulo, acao: PermissaoAcao) => boolean;
  podeVer: (modulo: PermissaoModulo) => boolean;
};

const PermissoesContext = createContext<PermissoesContextValue | null>(null);

export function PermissoesProvider({
  role,
  isOwner,
  permissoes,
  comissaoPercentual = 0,
  children,
}: {
  role: UserRole;
  isOwner: boolean;
  permissoes: PermissoesResolvidas;
  comissaoPercentual?: number;
  children: React.ReactNode;
}) {
  const value: PermissoesContextValue = {
    role,
    isOwner,
    permissoes,
    comissaoPercentual,
    pode: (modulo, acao) => isOwner || pode(permissoes, modulo, acao),
    podeVer: (modulo) => isOwner || podeVer(permissoes, modulo),
  };

  return <PermissoesContext.Provider value={value}>{children}</PermissoesContext.Provider>;
}

export function usePermissoes() {
  const ctx = useContext(PermissoesContext);
  if (!ctx) {
    throw new Error("usePermissoes deve ser usado dentro de PermissoesProvider");
  }
  return ctx;
}
