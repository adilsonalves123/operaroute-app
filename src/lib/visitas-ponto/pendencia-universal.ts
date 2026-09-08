import type { SupabaseClient } from "@supabase/supabase-js";

const TIPOS_UNIVERSAL = ["pagamento_pendente", "parcial", "visita_consolidada"] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Depois do checkout, a dívida da visita migra para pendência universal
 * (`visita_consolidada` / `parcial` com visita_ponto_id) e as coletas ficam
 * com saldo zerado. Apagar a coleta não apagava essa linha.
 *
 * Recalcula (ou remove) a pendência com o que ainda existe na visita.
 */
export async function sincronizarPendenciasUniversaisPonto(
  supabase: SupabaseClient,
  opts: { empresaId: string; pontoId: string }
): Promise<{ ajustadas: number }> {
  let ajustadas = 0;

  const { data: pends } = await supabase
    .from("pendencias")
    .select("id, valor, tipo, titulo, visita_ponto_id")
    .eq("empresa_id", opts.empresaId)
    .eq("ponto_id", opts.pontoId)
    .eq("status", "aberta")
    .in("tipo", [...TIPOS_UNIVERSAL]);

  const porVisita = new Map<string, typeof pends>();
  for (const p of pends ?? []) {
    const vpId = p.visita_ponto_id;
    const tipo = String(p.tipo ?? "").toLowerCase();
    const titulo = String(p.titulo ?? "").toLowerCase();
    const eUniversal =
      Boolean(vpId) &&
      (tipo === "visita_consolidada" ||
        titulo.includes("visita ao ponto") ||
        (tipo === "parcial" && titulo.includes("visita")));
    if (!eUniversal || !vpId) continue;
    const lista = porVisita.get(vpId) ?? [];
    lista.push(p);
    porVisita.set(vpId, lista);
  }

  if (porVisita.size === 0) return { ajustadas: 0 };

  const vpIds = [...porVisita.keys()];

  const [{ data: itens }, { data: visitasPonto }] = await Promise.all([
    supabase
      .from("visita_ponto_itens")
      .select("visita_ponto_id, coleta_id, cassino_visita_id")
      .in("visita_ponto_id", vpIds)
      .eq("empresa_id", opts.empresaId),
    supabase
      .from("visitas_ponto")
      .select("id, valor_pago")
      .in("id", vpIds)
      .eq("empresa_id", opts.empresaId),
  ]);

  const itensPorVisita = new Map<string, typeof itens>();
  for (const item of itens ?? []) {
    const lista = itensPorVisita.get(item.visita_ponto_id) ?? [];
    lista.push(item);
    itensPorVisita.set(item.visita_ponto_id, lista);
  }

  const visitaPontoPago = new Map(
    (visitasPonto ?? []).map((v) => [v.id, Number(v.valor_pago ?? 0)])
  );
  const visitasExistentes = new Set((visitasPonto ?? []).map((v) => v.id));

  const coletaIds = [
    ...new Set(
      (itens ?? [])
        .map((i) => i.coleta_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const cassinoIds = [
    ...new Set(
      (itens ?? [])
        .map((i) => i.cassino_visita_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const coletaValor = new Map<string, number>();
  if (coletaIds.length > 0) {
    const { data: coletas } = await supabase
      .from("coletas")
      .select("id, valor_a_receber")
      .in("id", coletaIds)
      .eq("empresa_id", opts.empresaId);
    for (const c of coletas ?? []) {
      coletaValor.set(c.id, Math.max(0, Number(c.valor_a_receber ?? 0)));
    }
  }

  const cassinoValor = new Map<string, number>();
  if (cassinoIds.length > 0) {
    const { data: visitas } = await supabase
      .from("visitas")
      .select("id, saldo_negativo, valor_operacao_efetivo, valor_operacao")
      .in("id", cassinoIds)
      .eq("empresa_id", opts.empresaId);
    for (const v of visitas ?? []) {
      if (v.saldo_negativo) continue;
      cassinoValor.set(
        v.id,
        Math.max(0, Number(v.valor_operacao_efetivo ?? v.valor_operacao ?? 0))
      );
    }
  }

  for (const [visitaPontoId, lista] of porVisita) {
    if (!visitasExistentes.has(visitaPontoId)) {
      for (const p of lista ?? []) {
        await supabase
          .from("pendencias")
          .delete()
          .eq("id", p.id)
          .eq("empresa_id", opts.empresaId);
        ajustadas++;
      }
      continue;
    }

    const itensVisita = itensPorVisita.get(visitaPontoId) ?? [];
    const origens = (itensVisita ?? []).filter(
      (i) =>
        (i.coleta_id && coletaValor.has(i.coleta_id)) ||
        (i.cassino_visita_id && cassinoValor.has(i.cassino_visita_id))
    );

    // Slots vazios (edição com preservar_slot): não mexe na pendência.
    if (origens.length === 0 && (itensVisita ?? []).length > 0) {
      continue;
    }

    let contrib = 0;
    for (const i of origens) {
      if (i.coleta_id && coletaValor.has(i.coleta_id)) {
        contrib += coletaValor.get(i.coleta_id) ?? 0;
      }
      if (i.cassino_visita_id && cassinoValor.has(i.cassino_visita_id)) {
        contrib += cassinoValor.get(i.cassino_visita_id) ?? 0;
      }
    }
    contrib = round2(contrib);
    const pago = round2(Math.max(0, visitaPontoPago.get(visitaPontoId) ?? 0));
    const novo = round2(Math.max(0, contrib - pago));

    const [principal, ...extras] = lista ?? [];
    for (const extra of extras) {
      await supabase
        .from("pendencias")
        .delete()
        .eq("id", extra.id)
        .eq("empresa_id", opts.empresaId);
      ajustadas++;
    }

    if (!principal) continue;

    if (novo <= 0.009) {
      await supabase
        .from("pendencias")
        .delete()
        .eq("id", principal.id)
        .eq("empresa_id", opts.empresaId);
      ajustadas++;
      continue;
    }

    if (Math.abs(Number(principal.valor ?? 0) - novo) > 0.019) {
      await supabase
        .from("pendencias")
        .update({ valor: novo })
        .eq("id", principal.id)
        .eq("empresa_id", opts.empresaId);
      ajustadas++;
    }
  }

  return { ajustadas };
}
