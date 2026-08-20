import type { SupabaseClient } from "@supabase/supabase-js";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import { getEquipamentoDisplayNome } from "@/lib/equipamentos";
import type {
  CassinoNegativoResumo,
  MaquinaResumoVisita,
  NichoResumoVisita,
  VisitaPontoItemRow,
  VisitaPontoNicho,
  VisitaPontoResumo,
  VisitaPontoRow,
} from "@/lib/visitas-ponto/types";
import { NICHO_VISITA_LABELS } from "@/lib/visitas-ponto/types";

type CassinoVisitaRow = {
  id: string;
  saldo_negativo: boolean | null;
  valor_operacao_efetivo: number | null;
  valor_operacao: number | null;
  valor_cliente: number | null;
  valor_pago: number | null;
  restante: number | null;
  /** Negativo recuperado pelo lucro nesta visita (vira dívida se o cliente não pagar). */
  debito_abatido?: number | null;
  total_lucro_centavos: number | null;
  created_at: string;
};

/**
 * Dívida cobrável da visita (checkout / reconciliação de pendências).
 *
 * - `restante` menor que a operação: haver descontado / pagamento parcial → usa restante.
 * - `restante` maior: lucro quitou negativo e a cobrança não paga inclui a devolução
 *   do adiantamento (ex.: op 560 + negativo 700 = 1260). O teto sobe com `debito_abatido`.
 * - Sem `debito_abatido`, não deixa “incluir pendência antiga” inflar além da operação.
 */
export function cobravelCassinoVisita(
  v: Pick<
    CassinoVisitaRow,
    "valor_operacao_efetivo" | "valor_pago" | "restante" | "debito_abatido"
  >
): number {
  const efetivo = Number(v.valor_operacao_efetivo ?? 0);
  const pago = Number(v.valor_pago ?? 0);
  const restanteCampo = Number(v.restante ?? NaN);
  const debitoAbatido = Math.max(0, Number(v.debito_abatido ?? 0));

  let porOperacao = 0;
  if (efetivo > 0.009 || pago > 0.009) {
    porOperacao = round2(Math.max(0, efetivo - pago));
  } else if (Number.isFinite(restanteCampo)) {
    return round2(Math.max(0, restanteCampo));
  } else {
    return 0;
  }

  if (!Number.isFinite(restanteCampo)) {
    return porOperacao;
  }

  const restante = round2(Math.max(0, restanteCampo));

  // Haver / parcial: restante ≤ operação efetiva − pago
  if (restante <= porOperacao + 0.009) {
    return restante;
  }

  // restante > operação: só eleva pelo negativo recuperado nesta visita
  const teto = round2(porOperacao + debitoAbatido);
  return round2(Math.min(restante, Math.max(porOperacao, teto)));
}

type ColetaRow = {
  id: string;
  nicho_modulo: string | null;
  valor_bruto: number | null;
  valor_a_receber: number | null;
  valor_pago_recebido: number | null;
  lucro_real: number | null;
  lucro_centavos: number | null;
  custo_brindes: number | null;
  entrada_periodo: number | null;
  entrada_atual?: number | null;
  saida_atual?: number | null;
  equipamento_id: string | null;
  equipamentos: { nome: string; numero_maquina: string | null; tipo: string | null } | { nome: string; numero_maquina: string | null; tipo: string | null }[] | null;
};

function pickEquipamento(
  eq: ColetaRow["equipamentos"]
): { nome: string; numero_maquina: string | null; tipo: string | null } | null {
  if (!eq) return null;
  return Array.isArray(eq) ? eq[0] ?? null : eq;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function buildCassinoNicho(
  visitaIds: string[],
  visitas: CassinoVisitaRow[],
  coletasPorVisita: Map<string, ColetaRow[]>
): { positivo: NichoResumoVisita | null; negativo: CassinoNegativoResumo | null } {
  const positivoMaquinas: MaquinaResumoVisita[] = [];
  let totalCobravel = 0;
  let totalRecebido = 0;
  let totalLucro = 0;
  let totalBruto = 0;
  let totalValorCliente = 0;
  let totalValorOperacao = 0;
  let negativo: CassinoNegativoResumo | null = null;

  for (const visitaId of visitaIds) {
    const v = visitas.find((x) => x.id === visitaId);
    if (!v) continue;

    const lucro = centesimosToReais(Number(v.total_lucro_centavos ?? 0));

    if (v.saldo_negativo) {
      negativo = {
        visitaId: v.id,
        valorOperacao: Number(v.valor_operacao ?? 0),
        lucroReais: lucro,
        titulo: "Visita cassino negativa",
        // Placeholder — montarResumo troca pelo link de edição com visita_ponto.
        href: `/coletas/visita/${v.id}`,
      };
      continue;
    }

    const cobravel = cobravelCassinoVisita(v);
    const recebido = Number(v.valor_pago ?? 0);
    totalCobravel += cobravel;
    totalRecebido += recebido;
    totalLucro += lucro;
    totalValorCliente += Number(v.valor_cliente ?? 0);
    totalValorOperacao += Number(v.valor_operacao ?? 0);

    const coletas = coletasPorVisita.get(visitaId) ?? [];
    for (const c of coletas) {
      const eq = pickEquipamento(c.equipamentos);
      const entrada = Number(c.entrada_periodo ?? 0);
      const entradaAtual = Number(c.entrada_atual ?? NaN);
      const saidaAtual = Number(c.saida_atual ?? NaN);
      totalBruto += entrada / 100;
      positivoMaquinas.push({
        id: c.equipamento_id ?? c.id,
        nome: eq ? getEquipamentoDisplayNome(eq) : "Máquina",
        numeroMaquina: eq?.numero_maquina,
        valorCobravel: centesimosToReais(Number(c.lucro_centavos ?? 0)),
        lucro: centesimosToReais(Number(c.lucro_centavos ?? 0)),
        entrada,
        ...(Number.isFinite(entradaAtual) ? { entradaAtual } : {}),
        ...(Number.isFinite(saidaAtual) ? { saidaAtual } : {}),
      });
    }

    if (positivoMaquinas.length === 0) {
      totalBruto += cobravel;
    }
  }

  const positivoVisitas = visitaIds.filter((id) => !visitas.find((v) => v.id === id)?.saldo_negativo);

  const positivo =
    positivoVisitas.length > 0
      ? {
          nicho: "cassino" as const,
          label: NICHO_VISITA_LABELS.cassino,
          totalCobravel: round2(totalCobravel),
          totalRecebido: round2(totalRecebido),
          totalLucro: round2(totalLucro),
          totalBruto: round2(totalBruto),
          custoBrindes: 0,
          valorCliente: round2(totalValorCliente),
          valorOperacao: round2(totalValorOperacao),
          maquinas: positivoMaquinas,
          itemIds: positivoVisitas,
          href: positivoVisitas.length === 1 ? `/coletas/visita/${positivoVisitas[0]}` : undefined,
        }
      : null;

  return { positivo, negativo };
}

function buildColetaNicho(
  nicho: VisitaPontoNicho,
  coletaIds: string[],
  coletas: ColetaRow[]
): NichoResumoVisita | null {
  const rows = coletaIds
    .map((id) => coletas.find((c) => c.id === id))
    .filter((c): c is ColetaRow => Boolean(c));

  if (rows.length === 0) return null;

  const maquinas: MaquinaResumoVisita[] = rows.map((c) => {
    const eq = pickEquipamento(c.equipamentos);
    const entrada =
      c.entrada_periodo != null
        ? centesimosToReais(Number(c.entrada_periodo))
        : Number(c.valor_bruto ?? 0);
    return {
      id: c.equipamento_id ?? c.id,
      nome: eq ? getEquipamentoDisplayNome(eq) : nicho === "fura_fura" ? "Fura-fura" : "Máquina",
      numeroMaquina: eq?.numero_maquina,
      valorCobravel: round2(
        Math.max(0, Number(c.valor_a_receber ?? 0) - Number(c.valor_pago_recebido ?? 0))
      ),
      lucro: Number(c.lucro_real ?? 0),
      entrada,
    };
  });

  const totalCobravel = rows.reduce(
    (s, c) =>
      s + Math.max(0, Number(c.valor_a_receber ?? 0) - Number(c.valor_pago_recebido ?? 0)),
    0
  );
  const totalRecebido = rows.reduce((s, c) => s + Number(c.valor_pago_recebido ?? 0), 0);
  const totalLucro = rows.reduce((s, c) => s + Number(c.lucro_real ?? 0), 0);
  const totalBruto = rows.reduce((s, c) => s + Number(c.valor_bruto ?? 0), 0);
  const custoBrindes = rows.reduce((s, c) => s + Number(c.custo_brindes ?? 0), 0);

  return {
    nicho,
    label: NICHO_VISITA_LABELS[nicho],
    totalCobravel: round2(totalCobravel),
    totalRecebido: round2(totalRecebido),
    totalLucro: round2(totalLucro),
    totalBruto: round2(totalBruto),
    custoBrindes: round2(custoBrindes),
    maquinas,
    itemIds: rows.map((c) => c.id),
    href:
      nicho === "fura_fura" && rows.length === 1
        ? `/coletas/nova/fura-fura?ponto=${visita.ponto_id}&visita_ponto=${visita.id}&editar_visita=${rows[0].id}`
        : nicho === "ursinho" && rows.length === 1
          ? `/coletas/ursinho/${rows[0].id}`
          : nicho === "diversao" && rows.length === 1
            ? `/coletas/diversao/${rows[0].id}`
            : nicho === "bolinha" && rows.length === 1
              ? `/coletas/bolinha/${rows[0].id}`
              : nicho === "consignado" && rows.length === 1
                ? `/coletas/consignado/${rows[0].id}`
            : undefined,
  };
}

export function montarResumoVisitaPonto(
  visita: VisitaPontoRow & { pontos: { nome: string } | { nome: string }[] | null },
  itens: VisitaPontoItemRow[],
  visitasCassino: CassinoVisitaRow[],
  coletas: ColetaRow[],
  coletasCassino: ColetaRow[]
): VisitaPontoResumo {
  const ponto = Array.isArray(visita.pontos) ? visita.pontos[0] : visita.pontos;

  const cassinoVisitaIds = [
    ...new Set(
      itens.filter((i) => i.nicho === "cassino" && i.cassino_visita_id).map((i) => i.cassino_visita_id!)
    ),
  ];
  const furaColetaIds = itens.filter((i) => i.nicho === "fura_fura" && i.coleta_id).map((i) => i.coleta_id!);
  const ursoColetaIds = itens.filter((i) => i.nicho === "ursinho" && i.coleta_id).map((i) => i.coleta_id!);
  const diversaoColetaIds = itens
    .filter((i) => i.nicho === "diversao" && i.coleta_id)
    .map((i) => i.coleta_id!);
  const bolinhaColetaIds = itens
    .filter((i) => i.nicho === "bolinha" && i.coleta_id)
    .map((i) => i.coleta_id!);
  const consignadoColetaIds = itens
    .filter((i) => i.nicho === "consignado" && i.coleta_id)
    .map((i) => i.coleta_id!);

  const coletasPorVisita = new Map<string, ColetaRow[]>();
  for (const c of coletasCassino) {
    const visitaId = (c as ColetaRow & { visita_id?: string }).visita_id;
    if (!visitaId) continue;
    const prev = coletasPorVisita.get(visitaId) ?? [];
    prev.push(c);
    coletasPorVisita.set(visitaId, prev);
  }

  const { positivo: cassinoPositivoRaw, negativo: cassinoNegativoRaw } = buildCassinoNicho(
    cassinoVisitaIds,
    visitasCassino,
    coletasPorVisita
  );

  const editCassinoHref = (visitaId: string) =>
    `/coletas/nova/cassino?ponto=${visita.ponto_id}&visita_ponto=${visita.id}&editar_visita=${visitaId}`;

  const cassinoNegativo = cassinoNegativoRaw
    ? { ...cassinoNegativoRaw, href: editCassinoHref(cassinoNegativoRaw.visitaId) }
    : null;

  const cassinoPositivo = cassinoPositivoRaw
    ? {
        ...cassinoPositivoRaw,
        href:
          cassinoPositivoRaw.itemIds.length === 1
            ? editCassinoHref(cassinoPositivoRaw.itemIds[0])
            : cassinoPositivoRaw.href,
      }
    : cassinoNegativo
      ? {
          nicho: "cassino" as const,
          label: NICHO_VISITA_LABELS.cassino,
          totalCobravel: 0,
          totalRecebido: 0,
          totalLucro: round2(cassinoNegativo.lucroReais),
          totalBruto: 0,
          custoBrindes: 0,
          maquinas: [],
          itemIds: [cassinoNegativo.visitaId],
          href: cassinoNegativo.href,
        }
      : null;

  const fura = buildColetaNicho("fura_fura", furaColetaIds, coletas);
  const urso = buildColetaNicho("ursinho", ursoColetaIds, coletas);
  const diversao = buildColetaNicho("diversao", diversaoColetaIds, coletas);
  const bolinha = buildColetaNicho("bolinha", bolinhaColetaIds, coletas);
  const consignado = buildColetaNicho("consignado", consignadoColetaIds, coletas);

  const nichos = [cassinoPositivo, fura, urso, diversao, bolinha, consignado].filter(
    (n): n is NichoResumoVisita => Boolean(n)
  );

  const subtotalCobravel = round2(nichos.reduce((s, n) => s + n.totalCobravel, 0));
  const totalRecebido = round2(nichos.reduce((s, n) => s + n.totalRecebido, 0));
  const totalLucro = round2(nichos.reduce((s, n) => s + n.totalLucro, 0));

  return {
    visitaPontoId: visita.id,
    pontoId: visita.ponto_id,
    pontoNome: ponto?.nome ?? "Ponto",
    status: visita.status,
    createdAt: visita.created_at,
    finalizadaEm: visita.finalizada_em,
    operadorId: visita.operador_id ?? null,
    nichos,
    cassinoNegativo: cassinoNegativo,
    subtotalCobravel,
    totalRecebido,
    totalLucro,
    itensConcluidos: itens.length,
    dividaRecebidaInicio: Number(visita.divida_recebida_inicio ?? 0),
    checkout:
      visita.status === "finalizada"
        ? {
            desconto: Number(visita.desconto ?? 0),
            valorPix: Number(visita.valor_pix ?? 0),
            valorDinheiro: Number(visita.valor_dinheiro ?? 0),
            valorPago: Number(visita.valor_pago ?? 0),
            totalCobrado: Number(visita.total_cobrado ?? 0),
            restante: Number(visita.restante ?? 0),
          }
        : null,
  };
}

export async function fetchVisitaPontoResumo(
  supabase: SupabaseClient,
  empresaId: string,
  visitaPontoId: string
): Promise<VisitaPontoResumo | null> {
  const id = String(visitaPontoId ?? "").trim();
  const eid = String(empresaId ?? "").trim();
  if (!id || !eid) return null;

  // Sem embed pontos(nome): join quebrado/RLS no admin gerava falso "não encontrada".
  let visita: VisitaPontoRow | null = null;

  const { data: byEmpresa, error: errEmpresa } = await supabase
    .from("visitas_ponto")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", eid)
    .maybeSingle();

  if (errEmpresa) {
    console.error("[fetchVisitaPontoResumo]", errEmpresa.message, { id, eid });
  }

  if (byEmpresa) {
    visita = byEmpresa as VisitaPontoRow;
  } else {
    // Fallback: busca só por id (service role) e confere empresa.
    const { data: byId, error: errId } = await supabase
      .from("visitas_ponto")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (errId) {
      console.error("[fetchVisitaPontoResumo] byId", errId.message, { id });
    }
    if (byId && String(byId.empresa_id) === eid) {
      visita = byId as VisitaPontoRow;
    }
  }

  if (!visita) return null;

  const { data: ponto } = await supabase
    .from("pontos")
    .select("nome")
    .eq("id", visita.ponto_id)
    .maybeSingle();

  const { data: itens } = await supabase
    .from("visita_ponto_itens")
    .select("*")
    .eq("visita_ponto_id", id)
    .order("ordem");

  const itemRows = (itens ?? []) as VisitaPontoItemRow[];
  const cassinoVisitaIds = itemRows
    .filter((i) => i.cassino_visita_id)
    .map((i) => i.cassino_visita_id!);
  const coletaIds = itemRows.filter((i) => i.coleta_id).map((i) => i.coleta_id!);

  const [visitasCassinoRes, coletasRes, coletasCassinoRes] = await Promise.all([
    cassinoVisitaIds.length > 0
      ? supabase
          .from("visitas")
          .select(
            "id, saldo_negativo, valor_operacao_efetivo, valor_operacao, valor_cliente, valor_pago, restante, debito_abatido, total_lucro_centavos, created_at"
          )
          .in("id", cassinoVisitaIds)
      : Promise.resolve({ data: [] as CassinoVisitaRow[] }),
    coletaIds.length > 0
      ? supabase
          .from("coletas")
          .select(
            "id, nicho_modulo, valor_bruto, valor_a_receber, valor_pago_recebido, lucro_real, custo_brindes, entrada_periodo, equipamento_id, equipamentos(nome, numero_maquina, tipo)"
          )
          .in("id", coletaIds)
      : Promise.resolve({ data: [] as ColetaRow[] }),
    cassinoVisitaIds.length > 0
      ? supabase
          .from("coletas")
          .select(
            "id, visita_id, lucro_centavos, entrada_periodo, entrada_atual, saida_atual, equipamento_id, equipamentos(nome, numero_maquina, tipo)"
          )
          .in("visita_id", cassinoVisitaIds)
      : Promise.resolve({ data: [] as (ColetaRow & { visita_id: string })[] }),
  ]);

  return montarResumoVisitaPonto(
    { ...visita, pontos: ponto ? { nome: ponto.nome } : null },
    itemRows,
    (visitasCassinoRes.data ?? []) as CassinoVisitaRow[],
    (coletasRes.data ?? []) as ColetaRow[],
    (coletasCassinoRes.data ?? []) as ColetaRow[]
  );
}
