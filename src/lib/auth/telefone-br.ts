/** Normaliza telefone BR para E.164 (+55…). */

export function digitosTelefone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Aceita (11) 99999-9999, 11999999999, 5511999999999, +55…
 * Retorna +5511999999999 ou null se inválido.
 */
export function toE164Brasil(raw: string): string | null {
  let d = digitosTelefone(raw);
  if (!d) return null;
  if (d.startsWith("55") && d.length >= 12) {
    // ok
  } else if (d.length === 10 || d.length === 11) {
    d = `55${d}`;
  } else {
    return null;
  }
  // BR móvel: 55 + DDD(2) + 9 + 8 dígitos = 13; fixo 12
  if (d.length < 12 || d.length > 13) return null;
  return `+${d}`;
}

export type CanalConfirmacao = "email" | "sms" | "whatsapp";

export function labelCanalConfirmacao(canal: CanalConfirmacao): string {
  if (canal === "sms") return "SMS";
  if (canal === "whatsapp") return "WhatsApp";
  return "e-mail";
}
