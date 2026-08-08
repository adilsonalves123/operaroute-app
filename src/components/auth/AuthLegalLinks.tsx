"use client";

import Link from "next/link";
import { SITE_LINKS } from "@/lib/site-links";

export function AuthLegalLinks() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[#5c6573]">
      <Link href={SITE_LINKS.termos} className="hover:text-[#8b93a3]">
        Termos
      </Link>
      <Link href={SITE_LINKS.privacidade} className="hover:text-[#8b93a3]">
        Privacidade
      </Link>
      <Link href="/suporte-contato" className="hover:text-[#8b93a3]">
        Suporte
      </Link>
    </div>
  );
}
