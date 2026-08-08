/** Links públicos do site (login, rodapé, e-mails). */

export function suporteWhatsAppUrl(text?: string): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP?.trim() ?? "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${phone}${q}`;
}

export const SITE_LINKS = {
  termos: "/termos",
  privacidade: "/privacidade",
  suporte: "/suporte-contato",
} as const;
