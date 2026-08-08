"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { moduloDaRota } from "@/lib/equipe/permissions";
import { usePermissoes } from "@/components/layout/PermissoesProvider";

export function RotaPermissaoGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { podeVer } = usePermissoes();

  useEffect(() => {
    const modulo = moduloDaRota(pathname);
    if (!modulo) return;
    if (!podeVer(modulo)) {
      router.replace("/dashboard?acesso=negado");
    }
  }, [pathname, podeVer, router]);

  return null;
}
