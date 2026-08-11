import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push/vapid";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { configured: false, error: "Push não configurado no servidor." },
      { status: 503 }
    );
  }
  return NextResponse.json({
    configured: true,
    publicKey: getVapidPublicKey(),
  });
}
