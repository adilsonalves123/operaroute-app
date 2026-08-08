import type { Metadata } from "next";
import Link from "next/link";
import { suporteWhatsAppUrl } from "@/lib/site-links";
import { SITE_LINKS } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Suporte — OperaRoute",
  description: "Fale com o suporte OperaRoute.",
};

export default function SuportePublicoPage() {
  const wa = suporteWhatsAppUrl("Olá! Preciso de suporte no OperaRoute.");
  const email =
    process.env.NEXT_PUBLIC_SUPORTE_EMAIL?.trim() ||
    process.env.SUPORTE_STAFF_EMAILS?.split(",")[0]?.trim() ||
    "";

  return (
    <div className="min-h-screen bg-[#05070d] text-[#e8edf5]">
      <div className="mx-auto max-w-md px-6 py-14">
        <Link
          href="/login"
          className="text-[12px] tracking-[0.14em] uppercase text-[#7dd3e8]/80 hover:text-[#7dd3e8]"
        >
          ← Voltar ao login
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-white">
          Suporte
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#8b93a3]">
          Escolha um canal. Respondemos o mais rápido possível em horário
          comercial.
        </p>

        <div className="mt-8 space-y-3">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="auth-submit-v2 block text-center"
            >
              WhatsApp
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent("Suporte OperaRoute")}`}
              className="auth-secondary-v2 block text-center"
            >
              E-mail · {email}
            </a>
          )}
          {!wa && !email && (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100">
              Canal ainda não configurado. Defina{" "}
              <code className="text-amber-50">NEXT_PUBLIC_SUPORTE_WHATSAPP</code>{" "}
              no ambiente.
            </p>
          )}
        </div>

        <div className="mt-10 flex gap-4 text-[12px] text-[#5c6573]">
          <Link href={SITE_LINKS.termos} className="hover:text-[#8b93a3]">
            Termos
          </Link>
          <Link href={SITE_LINKS.privacidade} className="hover:text-[#8b93a3]">
            Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}
