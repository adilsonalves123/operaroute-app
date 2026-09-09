import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura/pagamentos-fifo";
import { cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";
import { NICHO_VISITA_LABELS, type VisitaPontoNicho } from "@/lib/visitas-ponto/types";

const TIPOS_UNIVERSAL = ["pagamento_pendente", "parcial", "visita_consolidada"] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function labelNicho(raw: string | null | undefined): string {
  const n = String(raw ?? "") as VisitaPontoNicho;
  return NICHO_VISITA_LABELS[n] ?? "Coleta";
}

function formatBRL(n: number) {
  return n.toFixed(2).replace(".", ",");
}

/**
 * Depois do checkout, a dívida da visita migra para pendência universal
 * (`visita_consolidada` / `parcial` com visita_ponto_id).
 * O valor da consolidada = restante real dos itens (já desconta o pago no cassino/coleta).
 * Visitas antigas que “absorveram” inventando pagamento caem no fallback de `restante`.
 */
export async function sincronizarPendenciasUniversaisPonto(
  supabase: SupabaseClient,
  opts: { empresaId: string; pontoId: string }
): Promise<{ ajustadas: number }> {
  let ajustadas = 0;

  const { data: pends } = await supabase
    .from("pendencias")
    .select("id, valor, tipo, titulo, visita_ponto_id, descricao")
    .eq("empresa_id", opts.empresaId)
    .eq("ponto_id", opts.pontoId)
    .eq("status", "aberta")
    .in("tipo", [...TIPOS_UNIVERSAL]);

  const porVisita = new Map<string, NonNullable<typeof pends>>();
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
      .select("visita_ponto_id, coleta_id, cassino_visita_id, nicho")
      .in("visita_ponto_id", vpIds)
      .eq("empresa_id", opts.empresaId),
    supabase
      .from("visitas_ponto")
      .select("id, valor_pago, restante, status, desconto, subtotal_cobravel, pontos(nome)")
      .in("id", vpIds)
      .eq("empresa_id", opts.empresaId),
  ]);

  const itensPorVisita = new Map<string, NonNullable<typeof itens>>();
  for (const item of itens ?? []) {
    const lista = itensPorVisita.get(item.visita_ponto_id) ?? [];
    lista.push(item);
    itensPorVisita.set(item.visita_ponto_id, lista);
  }

  const visitaPontoPago = new Map(
    (visitasPonto ?? []).map((v) => [v.id, Number(v.valor_pago ?? 0)])
  );
  const visitaPontoRestante = new Map(
    (visitasPonto ?? []).map((v) => [v.id, Math.max(0, Number(v.restante ?? 0))])
  );
  const visitaPontoDesconto = new Map(
    (visitasPonto ?? []).map((v) => [v.id, Math.max(0, Number(v.desconto ?? 0))])
  );
  const visitaPontoSubtotal = new Map(
    (visitasPonto ?? []).map((v) => [v.id, Math.max(0, Number(v.subtotal_cobravel ?? 0))])
  );
  const visitaPontoStatus = new Map(
    (visitasPonto ?? []).map((v) => [v.id, String(v.status ?? "").toLowerCase()])
  );
  const visitaPontoNome = new Map(
    (visitasPonto ?? []).map((v) => {
      const p = Array.isArray(v.pontos) ? v.pontos[0] : v.pontos;
      return [v.id, (p as { nome?: string } | null)?.nome ?? ""] as const;
    })
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

  const coletaRestante = new Map<string, number>();
  if (coletaIds.length > 0) {
    const { data: coletas } = await supabase
      .from("coletas")
      .select("id, valor_a_receber, valor_pago_recebido")
      .in("id", coletaIds)
      .eq("empresa_id", opts.empresaId);
    for (const c of coletas ?? []) {
      coletaRestante.set(c.id, Math.max(0, saldoPendenteColeta(c)));
    }
  }

  const cassinoRestante = new Map<string, number>();
  if (cassinoIds.length > 0) {
    const { data: visitas } = await supabase
      .from("visitas")
      .select(
        "id, saldo_negativo, valor_operacao_efetivo, valor_operacao, valor_pago, restante, debito_abatido"
      )
      .in("id", cassinoIds)
      .eq("empresa_id", opts.empresaId);
    for (const v of visitas ?? []) {
      if (v.saldo_negativo) continue;
      cassinoRestante.set(v.id, Math.max(0, cobravelCassinoVisita(v)));
    }
  }

  async function apagarLista(lista: NonNullable<typeof pends>) {
    for (const p of lista ?? []) {
      await supabase
        .from("pendencias")
        .delete()
        .eq("id", p.id)
        .eq("empresa_id", opts.empresaId);
      ajustadas++;
    }
  }

  for (const [visitaPontoId, lista] of porVisita) {
    if (!visitasExistentes.has(visitaPontoId)) {
      await apagarLista(lista ?? []);
      continue;
    }

    const itensVisita = itensPorVisita.get(visitaPontoId) ?? [];
    const origens = (itensVisita ?? []).filter(
      (i) =>
        (i.coleta_id && coletaRestante.has(i.coleta_id)) ||
        (i.cassino_visita_id && cassinoRestante.has(i.cassino_visita_id))
    );

    const status = visitaPontoStatus.get(visitaPontoId) ?? "";
    // Rascunho em edição: slots vazios ainda vão religar. Visita já fechada
    // sem coleta/visita viva = dívida fantasma — apaga.
    if (origens.length === 0) {
      if (status === "rascunho" && (itensVisita ?? []).length > 0) {
        continue;
      }
      await apagarLista(lista ?? []);
      continue;
    }

    const porNicho = new Map<string, number>();
    let restanteItens = 0;
    for (const i of origens) {
      let v = 0;
      if (i.coleta_id && coletaRestante.has(i.coleta_id)) {
        v = coletaRestante.get(i.coleta_id) ?? 0;
      }
      if (i.cassino_visita_id && cassinoRestante.has(i.cassino_visita_id)) {
        v += cassinoRestante.get(i.cassino_visita_id) ?? 0;
      }
      if (v <= 0.009) continue;
      restanteItens += v;
      const lab = labelNicho(i.nicho);
      porNicho.set(lab, round2((porNicho.get(lab) ?? 0) + v));
    }
    restanteItens = round2(restanteItens);
    const pago = round2(Math.max(0, visitaPontoPago.get(visitaPontoId) ?? 0));
    const desconto = round2(Math.max(0, visitaPontoDesconto.get(visitaPontoId) ?? 0));
    const subtotal = round2(Math.max(0, visitaPontoSubtotal.get(visitaPontoId) ?? 0));
    const restanteSnapshot = round2(
      Math.max(0, visitaPontoRestante.get(visitaPontoId) ?? 0)
    );
    // Itens com pagamento real → soma dos restantes.
    // Legado (absorveu inventando quitação) → usa o restante gravado na visita.
    let novo = restanteItens;
    if (novo <= 0.009 && restanteSnapshot > 0.009) {
      novo = restanteSnapshot;
    }
    // Desconto do checkout ainda no cobravel bruto (legado): não cobrar de novo.
    if (
      novo > 0.009 &&
      desconto > 0.009 &&
      subtotal > 0.009 &&
      restanteItens + 0.02 >= subtotal
    ) {
      novo = round2(Math.max(0, novo - desconto));
    }

    const [principal, ...extras] = lista ?? [];
    await apagarLista(extras);

    if (!principal) continue;

    if (novo <= 0.009) {
      await apagarLista([principal]);
      continue;
    }

    const pontoNome = visitaPontoNome.get(visitaPontoId) ?? "";
    const linhasNicho =
      porNicho.size > 0
        ? [...porNicho.entries()].map(([lab, v]) => `${lab}: ${formatBRL(v)}`)
        : [];
    const descricao = [
      pontoNome,
      ...linhasNicho,
      `Total visita: R$ ${formatBRL(round2(novo + pago))}`,
      `Pago: R$ ${formatBRL(pago)}`,
      `Pendência universal: R$ ${formatBRL(novo)}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const valorMudou = Math.abs(Number(principal.valor ?? 0) - novo) > 0.019;
    const descMudou = String(principal.descricao ?? "") !== descricao;
    if (valorMudou || descMudou) {
      await supabase
        .from("pendencias")
        .update({ valor: novo, descricao })
        .eq("id", principal.id)
        .eq("empresa_id", opts.empresaId);
      ajustadas++;
    }
  }

  return { ajustadas };
}
