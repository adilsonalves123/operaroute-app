"use client";

import { createContext, useContext } from "react";
import type { PermissaoAcao, PermissaoModulo, PermissoesResolvidas } from "@/lib/equipe/permissions";
import { pode, podeVer } from "@/lib/equipe/permissions";
import type { UserRole } from "@/lib/types/database";

export type IaLeituraFotoInfo = {
  liberada: boolean;
  motivo: "plano" | "trial" | "bloqueada";
  planoAtual: string;
  planosComIa: string;
};

const IA_LIBERADA_PADRAO: IaLeituraFotoInfo = {
  liberada: true,
  motivo: "plano",
  planoAtual: "",
  planosComIa: "Pro e Elite",
};

type PermissoesContextValue = {
  role: UserRole;
  isOwner: boolean;
  permissoes: PermissoesResolvidas;
  /** % da Equipe sobre lucro após brindes. */
  comissaoPercentual: number;
  /** Menu Rascunho ligado nas configurações da empresa. */
  rascunhoDashboardAtivo: boolean;
  /** Operador vê só pontos/valores publicados; coleta real continua. */
  visaoRestrita: boolean;
  visaoPontoIds: string[];
  /** Leitura por foto com IA — só Pro/Elite (ou trial). */
  iaLeituraFoto: IaLeituraFotoInfo;
  pode: (modulo: PermissaoModulo, acao: PermissaoAcao) => boolean;
  podeVer: (modulo: PermissaoModulo) => boolean;
};

const PermissoesContext = createContext<PermissoesContextValue | null>(null);

export function PermissoesProvider({
  role,
  isOwner,
  permissoes,
  comissaoPercentual = 0,
  rascunhoDashboardAtivo = false,
  visaoRestrita = false,
  visaoPontoIds = [],
  iaLeituraFoto = IA_LIBERADA_PADRAO,
  children,
}: {
  role: UserRole;
  isOwner: boolean;
  permissoes: PermissoesResolvidas;
  comissaoPercentual?: number;
  rascunhoDashboardAtivo?: boolean;
  visaoRestrita?: boolean;
  visaoPontoIds?: string[];
  iaLeituraFoto?: IaLeituraFotoInfo;
  children: React.ReactNode;
}) {
  const value: PermissoesContextValue = {
    role,
    isOwner,
    permissoes,
    comissaoPercentual,
    rascunhoDashboardAtivo,
    visaoRestrita,
    visaoPontoIds,
    iaLeituraFoto,
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

/** Fora do provider assume liberada — o servidor continua bloqueando se o plano não tiver IA. */
export function useIaLeituraFoto(): IaLeituraFotoInfo {
  return useContext(PermissoesContext)?.iaLeituraFoto ?? IA_LIBERADA_PADRAO;
}
