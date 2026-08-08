"use client";

import { usePathname } from "next/navigation";
import { FunilBeacon } from "@/components/dono/FunilBeacon";

export function AuthFunilTracker() {
  const pathname = usePathname();
  if (pathname.startsWith("/cadastro")) {
    return <FunilBeacon tipo="visita_cadastro" />;
  }
  if (pathname.startsWith("/login")) {
    return <FunilBeacon tipo="visita_login" />;
  }
  return null;
}
