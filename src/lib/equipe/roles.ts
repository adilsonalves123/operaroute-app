import type { UserRole } from "@/lib/types/database";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  operador: "Operador",
  visualizador: "Visualizador",
};

/** Papéis que podem ser atribuídos ao cadastrar/editar pela UI */
export const ROLES_CADASTRO: UserRole[] = ["gerente", "operador", "visualizador"];

export function labelRole(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function isRoleCadastro(role: string): role is UserRole {
  return ROLES_CADASTRO.includes(role as UserRole);
}
