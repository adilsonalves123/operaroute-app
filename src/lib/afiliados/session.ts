import { AFILIADO_SESSION_COOKIE } from "@/lib/afiliados/core";
import {
  parseAfiliadoToken,
  type AfiliadoSession,
} from "@/lib/afiliados/senha";
import { cookies } from "next/headers";

export async function getAfiliadoSession(): Promise<AfiliadoSession | null> {
  const jar = await cookies();
  return parseAfiliadoToken(jar.get(AFILIADO_SESSION_COOKIE)?.value);
}
