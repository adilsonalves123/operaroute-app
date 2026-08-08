import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { buildDonoCommand } from "@/lib/dono/command";

export async function GET() {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Faça login no painel do dono." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY necessária." },
      { status: 503 }
    );
  }

  const data = await buildDonoCommand();
  return NextResponse.json(data);
}
