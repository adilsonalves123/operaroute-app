import type { UserRole } from "@/lib/types/database";

/** Admin/owner não consome vaga — limite é para gerentes, operadores etc. */
export function membroContaNoLimite(role: UserRole, status: string): boolean {
  return status === "ativo" && role !== "admin";
}

export function contarMembrosEquipeAtivos(
  membros: { role: UserRole; status: string }[]
): number {
  return membros.filter((m) => membroContaNoLimite(m.role, m.status)).length;
}

/** Mínimo 10 colaboradores além do admin (corrige planos antigos com limite 1). */
export function getLimiteUsuariosEquipe(limiteUsuarios?: number | null): number {
  const raw = limiteUsuarios && limiteUsuarios > 0 ? limiteUsuarios : 10;
  return Math.max(raw, 10);
}

export function canAddMembroEquipe(
  membrosAtivosNoLimite: number,
  limiteUsuarios?: number | null
): boolean {
  return membrosAtivosNoLimite < getLimiteUsuariosEquipe(limiteUsuarios);
}
