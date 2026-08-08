import { cookies } from "next/headers";
import {
  donoCookieName,
  parseDonoToken,
  type DonoSession,
} from "@/lib/dono/auth";

export async function getDonoSession(): Promise<DonoSession | null> {
  const jar = await cookies();
  return parseDonoToken(jar.get(donoCookieName())?.value);
}

export async function requireDonoSession(): Promise<DonoSession> {
  const s = await getDonoSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}
