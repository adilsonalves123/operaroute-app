import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseAbatido(descricao: string | null): number {
  if (!descricao) return 0;
  const m = descricao.match(
    /(?:baixa\s+de|abatido)\s*r\$\s*([\d.]+(?:,\d{2})?)/i
  );
  if (!m) return 0;
  const raw = m[1].includes(",")
    ? m[1].replace(/\./g, "").replace(",", ".")
    : m[1];
  return round2(Number(raw) || 0);
}

function visitaTagId(descricao: string | null): string | null {
  if (!descricao) return null;
  const m = descricao.match(/\[visita:([0-9a-f-]{36})\]/i);
  return m?.[1] ?? null;
}

/**
 * Corrige valor_pago fantasma: pendência abatida em visita negativa
 * não é recebimento de caixa.
 */
async function runFix() {
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabase = await createClient();
  const empresaId = profile.empresa_id;

  const { data: negVisitas, error: nErr } = await supabase
    .from("visitas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("saldo_negativo", true);
  if (nErr) {
    return NextResponse.json({ error: nErr.message }, { status: 500 });
  }
  const negIds = new Set((negVisitas ?? []).map((v) => v.id));

  const { data: pends, error: pErr } = await supabase
    .from("pendencias")
    .select("id, visita_id, tipo, descricao")
    .eq("empresa_id", empresaId)
    .in("tipo", ["pagamento_pendente", "parcial", "visita_consolidada"]);
  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const reverterPorVisita = new Map<string, number>();
  for (const p of pends ?? []) {
    const negId = visitaTagId(p.descricao);
    if (!negId || !negIds.has(negId)) continue;
    const origem = p.visita_id as string | null;
    if (!origem || negIds.has(origem)) continue;
    const abatido = parseAbatido(p.descricao);
    if (abatido <= 0.009) continue;
    reverterPorVisita.set(
      origem,
      round2((reverterPorVisita.get(origem) ?? 0) + abatido)
    );
  }

  const detalhes: {
    visitaId: string;
    pagoAntes: number;
    pagoDepois: number;
    reverteu: number;
  }[] = [];

  for (const [visitaId, abatido] of reverterPorVisita) {
    const { data: v } = await supabase
      .from("visitas")
      .select("id, valor_pago, restante, valor_operacao_efetivo, valor_operacao")
      .eq("id", visitaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!v) continue;

    const pago = Number(v.valor_pago ?? 0);
    if (pago <= 0.009) continue;

    const tirar = round2(Math.min(pago, abatido));
    const novoPago = round2(pago - tirar);
    const efetivo = Number(v.valor_operacao_efetivo ?? v.valor_operacao ?? 0);
    const novoRestante =
      efetivo > 0.009
        ? round2(Math.max(0, efetivo - novoPago))
        : round2(Math.max(0, Number(v.restante ?? 0)));

    const { error: uErr } = await supabase
      .from("visitas")
      .update({ valor_pago: novoPago, restante: novoRestante })
      .eq("id", visitaId)
      .eq("empresa_id", empresaId);
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
    detalhes.push({
      visitaId,
      pagoAntes: pago,
      pagoDepois: novoPago,
      reverteu: tirar,
    });
  }

  return NextResponse.json({
    ok: true,
    corrigidas: detalhes.length,
    detalhes,
  });
}

export async function GET() {
  return runFix();
}

export async function POST() {
  return runFix();
}
