/** Cookie de sessão para pré-visualizar telas de trial sem alterar o banco. */
export const COOKIE_SIMULAR_TRIAL = "or_simular_trial";

export type ModoSimularTrial = "expirado" | "off";

export function parseModoSimularTrial(
  value: string | undefined | null
): ModoSimularTrial {
  if (value === "expirado") return "expirado";
  return "off";
}
