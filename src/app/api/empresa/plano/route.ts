import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  limiteFromFaixa,
  NICHOS_PAGOS,
  normalizeFaixaPontos,
  type FaixaPontos,
} from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  let body: { nichos?: Nicho[]; quantidade_pontos?: FaixaPontos | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const pagosSelecionados = (body.nichos ?? []).filter((n) => NICHOS_PAGOS.includes(n));
  if (pagosSelecionados.length === 0) {
    return NextResponse.json(
      { error: "Selecione pelo menos um nicho (Fura Fura ou Máquinas / Cassino)." },
      { status: 400 }
    );
  }

  const quantidadePontos = normalizeFaixaPontos(body.quantidade_pontos);
  const limitePontos = limiteFromFaixa(quantidadePontos);
  const nichoPrincipal = pagosSelecionados[0];
  const empresaId = profile.empresa_id;

  const supabase = await createClient();

  const rows = [
    ...NICHOS_PAGOS.map((nicho) => ({
      empresa_id: empresaId,
      nicho,
      ativo: pagosSelecionados.includes(nicho),
    })),
    { empresa_id: empresaId, nicho: "outros" as Nicho, ativo: true },
  ];

  const { error: nichoError } = await supabase
    .from("empresa_nichos")
    .upsert(rows, { onConflict: "empresa_id,nicho" });

  if (nichoError) {
    const msg = nichoError.message ?? "";
    const needsMigration =
      msg.includes("empresa_nichos") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist");

    return NextResponse.json(
      {
        error: needsMigration
          ? "Tabela empresa_nichos não existe. Rode supabase/multi-nicho.sql no Supabase SQL Editor."
          : msg,
      },
      { status: 500 }
    );
  }

  const { error: empresaError } = await supabase
    .from("empresas")
    .update({
      quantidade_pontos: quantidadePontos,
      limite_pontos: limitePontos,
      nicho: nichoPrincipal,
    })
    .eq("id", empresaId);

  if (empresaError) {
    return NextResponse.json({ error: empresaError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    nichos_ativos: [...pagosSelecionados, "outros"],
    quantidade_pontos: quantidadePontos,
  });
}
