import type { SupabaseClient } from "@supabase/supabase-js";
import { calcPrecoMensal, normalizeFaixaPontos } from "@/lib/pricing";
import { loadPrecosPayload } from "@/lib/dono/precos";
import { resolveNichosAtivos } from "@/lib/assinatura";
import type { Nicho } from "@/lib/types/database";

export type TenantStatusSaude =
  | "ativo"
  | "trial"
  | "trial_expirando"
  | "trial_expirado"
  | "inativo"
  | "suspenso";

export type TenantResumo = {
  id: string;
  nome_operacao: string;
  owner_id: string | null;
  nicho: string | null;
  quantidade_pontos: string | null;
  plano: string | null;
  status: string | null;
  limite_pontos: number | null;
  limite_usuarios: number | null;
  created_at: string;
  ciclo_cobranca: "mensal" | "anual";
  nichos_ativos: Nicho[];
  /** Preço de catálogo (não é receita). */
  mrr_estimado: number | null;
  /** MRR real: só se houver pagamento confirmado (R$). */
  mrr_pago: number;
  owner_nome: string | null;
  owner_email: string | null;
  owner_whatsapp: string | null;
  /** Tem perfil de dono vinculado (não é shell órfã). */
  cliente_real: boolean;
  /** Pagamento confirmado (MP/pago) e período ainda válido. */
  pagamento_confirmado: boolean;
  assinatura_ativa: boolean;
  trial_inicio: string | null;
  trial_fim: string | null;
  assinatura_vence_em: string | null;
  onboarding_completo: boolean;
  saude: TenantStatusSaude;
  pontos_count: number;
  equipamentos_count: number;
  equipe_count: number;
  ultima_atividade: string | null;
};

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Saúde baseada em pagamento real + trial — ignora flag fantasma de assinatura. */
export function classificarSaude(input: {
  status: string | null;
  assinatura_ativa: boolean;
  trial_fim: string | null;
  pagamento_confirmado?: boolean;
}): TenantStatusSaude {
  if ((input.status ?? "").toLowerCase() === "suspenso") return "suspenso";
  if ((input.status ?? "").toLowerCase() === "inativo") return "inativo";

  if (input.pagamento_confirmado) return "ativo";

  const dias = diasAte(input.trial_fim);
  if (dias != null && dias < 0) return "trial_expirado";
  if (dias != null && dias <= 3) return "trial_expirando";
  if (dias != null) return "trial";

  // Flag assinatura_ativa sem pagamento e sem trial = dado legado/fantasma
  return "inativo";
}

function isClienteRelevante(t: TenantResumo): boolean {
  return (
    t.cliente_real &&
    (t.saude === "ativo" ||
      t.saude === "trial" ||
      t.saude === "trial_expirando" ||
      t.saude === "trial_expirado" ||
      t.saude === "suspenso")
  );
}

export async function fetchTenantsPlataforma(
  admin: SupabaseClient
): Promise<TenantResumo[]> {
  let empresas: {
    id: string;
    owner_id: string | null;
    nome_operacao: string;
    nicho: string | null;
    quantidade_pontos: string | null;
    plano: string | null;
    status: string | null;
    limite_pontos: number | null;
    limite_usuarios: number | null;
    created_at: string;
    ciclo_cobranca?: string | null;
    assinatura_vence_em?: string | null;
  }[] = [];

  {
    const full = await admin
      .from("empresas")
      .select(
        "id, owner_id, nome_operacao, nicho, quantidade_pontos, plano, status, limite_pontos, limite_usuarios, created_at, ciclo_cobranca, assinatura_vence_em"
      )
      .order("created_at", { ascending: false });

    if (full.error) {
      const fallback = await admin
        .from("empresas")
        .select(
          "id, owner_id, nome_operacao, nicho, quantidade_pontos, plano, status, limite_pontos, limite_usuarios, created_at"
        )
        .order("created_at", { ascending: false });
      if (fallback.error || !fallback.data?.length) return [];
      empresas = fallback.data;
    } else {
      if (!full.data?.length) return [];
      empresas = full.data;
    }
  }

  const empresaIds = empresas.map((e) => e.id);
  const ownerIds = [
    ...new Set(empresas.map((e) => e.owner_id).filter((id): id is string => Boolean(id))),
  ];

  const precos = await loadPrecosPayload(admin);
  const planos = precos.planos;

  const [
    { data: nichosRows },
    { data: profilesByEmpresa },
    { data: profilesByOwner },
    { data: pontos },
    { data: equipamentos },
    { data: equipe },
    { data: pagamentos },
    { data: checkoutsPagos },
  ] = await Promise.all([
    admin.from("empresa_nichos").select("empresa_id, nicho").in("empresa_id", empresaIds),
    admin
      .from("profiles")
      .select(
        "user_id, empresa_id, nome, email, whatsapp, assinatura_ativa, trial_inicio, trial_fim, onboarding_completo"
      )
      .in("empresa_id", empresaIds),
    ownerIds.length
      ? admin
          .from("profiles")
          .select(
            "user_id, empresa_id, nome, email, whatsapp, assinatura_ativa, trial_inicio, trial_fim, onboarding_completo"
          )
          .in("user_id", ownerIds)
      : Promise.resolve({ data: [] as never[] }),
    admin.from("pontos").select("id, empresa_id, ultima_coleta, created_at").in("empresa_id", empresaIds),
    admin.from("equipamentos").select("id, empresa_id").in("empresa_id", empresaIds),
    admin.from("equipe").select("id, empresa_id").in("empresa_id", empresaIds),
    admin
      .from("plataforma_pagamentos")
      .select("empresa_id, valor_centavos, ciclo, pago_em, status")
      .eq("status", "pago")
      .in("empresa_id", empresaIds)
      .order("pago_em", { ascending: false }),
    admin
      .from("plataforma_checkout")
      .select("empresa_id, valor_centavos, ciclo, paid_at, status")
      .eq("status", "pago")
      .in("empresa_id", empresaIds)
      .order("paid_at", { ascending: false }),
  ]);

  const nichosByEmp = new Map<string, Nicho[]>();
  for (const row of nichosRows ?? []) {
    const list = nichosByEmp.get(row.empresa_id) ?? [];
    list.push(row.nicho as Nicho);
    nichosByEmp.set(row.empresa_id, list);
  }

  const profileList = [...(profilesByEmpresa ?? []), ...(profilesByOwner ?? [])];
  const profileByUserId = new Map<string, (typeof profileList)[number]>();
  for (const p of profileList) {
    if (p.user_id) profileByUserId.set(p.user_id, p);
  }
  const profileByEmp = new Map<string, (typeof profileList)[number]>();
  for (const p of profilesByEmpresa ?? []) {
    if (!p.empresa_id) continue;
    if (!profileByEmp.has(p.empresa_id)) profileByEmp.set(p.empresa_id, p);
  }
  for (const e of empresas) {
    if (!e.owner_id) continue;
    const ownerProf = profileByUserId.get(e.owner_id);
    if (ownerProf) profileByEmp.set(e.id, ownerProf);
  }

  type PagamentoInfo = { valor_centavos: number; ciclo: "mensal" | "anual"; pago_em: string };
  const ultimoPagoByEmp = new Map<string, PagamentoInfo>();
  for (const p of pagamentos ?? []) {
    if (!p.empresa_id || ultimoPagoByEmp.has(p.empresa_id)) continue;
    ultimoPagoByEmp.set(p.empresa_id, {
      valor_centavos: Number(p.valor_centavos) || 0,
      ciclo: p.ciclo === "anual" ? "anual" : "mensal",
      pago_em: String(p.pago_em ?? ""),
    });
  }
  for (const c of checkoutsPagos ?? []) {
    if (!c.empresa_id || ultimoPagoByEmp.has(c.empresa_id)) continue;
    ultimoPagoByEmp.set(c.empresa_id, {
      valor_centavos: Number(c.valor_centavos) || 0,
      ciclo: c.ciclo === "anual" ? "anual" : "mensal",
      pago_em: String(c.paid_at ?? ""),
    });
  }

  const countBy = (rows: { empresa_id: string }[] | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      m.set(r.empresa_id, (m.get(r.empresa_id) ?? 0) + 1);
    }
    return m;
  };

  const pontosCount = countBy(pontos);
  const eqCount = countBy(equipamentos);
  const eqpCount = countBy(equipe);

  const ultimaByEmp = new Map<string, string>();
  for (const p of pontos ?? []) {
    const ts = p.ultima_coleta ?? p.created_at;
    if (!ts) continue;
    const prev = ultimaByEmp.get(p.empresa_id);
    if (!prev || ts > prev) ultimaByEmp.set(p.empresa_id, ts);
  }

  return empresas.map((e) => {
    const prof = profileByEmp.get(e.id);
    const cliente_real = Boolean(e.owner_id && prof);
    const nichos = resolveNichosAtivos(
      nichosByEmp.get(e.id) ?? null,
      e.nicho as Nicho | null
    );
    const mrrCatalogo = calcPrecoMensal(
      normalizeFaixaPontos(e.quantidade_pontos),
      nichos,
      planos
    );

    const venceEm = (e as { assinatura_vence_em?: string | null }).assinatura_vence_em ?? null;
    const venceDias = diasAte(venceEm);
    const ultimoPago = ultimoPagoByEmp.get(e.id);
    const pagamento_confirmado = Boolean(
      ultimoPago && (venceDias == null || venceDias >= 0)
    );

    let mrr_pago = 0;
    if (pagamento_confirmado && ultimoPago) {
      const reais = ultimoPago.valor_centavos / 100;
      mrr_pago = ultimoPago.ciclo === "anual" ? reais / 12 : reais;
    }

    const assinatura_ativa = Boolean(prof?.assinatura_ativa);
    const trial_fim = prof?.trial_fim ?? null;
    const ciclo =
      (e as { ciclo_cobranca?: string }).ciclo_cobranca === "anual" ||
      ultimoPago?.ciclo === "anual"
        ? "anual"
        : "mensal";

    return {
      id: e.id,
      nome_operacao: e.nome_operacao,
      owner_id: e.owner_id,
      nicho: e.nicho,
      quantidade_pontos: e.quantidade_pontos,
      plano: e.plano,
      status: e.status,
      limite_pontos: e.limite_pontos,
      limite_usuarios: e.limite_usuarios,
      created_at: e.created_at,
      ciclo_cobranca: ciclo as "mensal" | "anual",
      nichos_ativos: nichos.filter((n) => n !== "outros"),
      mrr_estimado: mrrCatalogo,
      mrr_pago,
      owner_nome: prof?.nome ?? null,
      owner_email: prof?.email ?? null,
      owner_whatsapp: prof?.whatsapp ?? null,
      cliente_real,
      pagamento_confirmado,
      assinatura_ativa,
      trial_inicio: prof?.trial_inicio ?? null,
      trial_fim,
      assinatura_vence_em: venceEm,
      onboarding_completo: Boolean(prof?.onboarding_completo),
      saude: classificarSaude({
        status: e.status,
        assinatura_ativa,
        trial_fim,
        pagamento_confirmado,
      }),
      pontos_count: pontosCount.get(e.id) ?? 0,
      equipamentos_count: eqCount.get(e.id) ?? 0,
      equipe_count: eqpCount.get(e.id) ?? 0,
      ultima_atividade: ultimaByEmp.get(e.id) ?? e.created_at,
    };
  });
}

export type PlataformaOverview = {
  total_empresas: number;
  ativos: number;
  trials: number;
  trials_expirando: number;
  trials_expirados: number;
  suspensos: number;
  /** MRR real (pagamentos confirmados). */
  mrr_estimado: number;
  /** Preço de catálogo dos clientes relevantes (não é caixa). */
  mrr_potencial: number;
  arr_estimado: number;
  arpu: number;
  novos_7d: number;
  novos_30d: number;
  suporte_humano_aberto: number;
  onboarding_incompleto: number;
  orfas_ocultas: number;
  por_faixa: { faixa: string; count: number; mrr: number }[];
  por_nicho: { nicho: string; count: number }[];
  recentes: TenantResumo[];
  em_risco: TenantResumo[];
};

export function buildOverview(
  tenants: TenantResumo[],
  suporteHumanoAberto: number
): PlataformaOverview {
  const agora = Date.now();
  const d7 = agora - 7 * 24 * 60 * 60 * 1000;
  const d30 = agora - 30 * 24 * 60 * 60 * 1000;

  const orfas = tenants.filter((t) => !t.cliente_real);
  const reais = tenants.filter((t) => t.cliente_real);

  const mrrPago = reais.reduce((s, t) => s + (t.mrr_pago || 0), 0);
  const mrrPotencial = reais.reduce((s, t) => {
    if (t.saude === "suspenso" || t.saude === "inativo" || t.saude === "trial_expirado") {
      return s;
    }
    return s + (t.mrr_estimado ?? 0);
  }, 0);

  const ativosPagantes = reais.filter((t) => t.pagamento_confirmado);

  const faixaMap = new Map<string, { count: number; mrr: number }>();
  const nichoMap = new Map<string, number>();

  for (const t of reais) {
    if (!isClienteRelevante(t) && t.saude === "inativo") continue;

    const f = normalizeFaixaPontos(t.quantidade_pontos);
    const cur = faixaMap.get(f) ?? { count: 0, mrr: 0 };
    if (t.saude === "ativo" || t.saude === "trial" || t.saude === "trial_expirando") {
      cur.count += 1;
      cur.mrr += t.mrr_pago || 0;
    }
    faixaMap.set(f, cur);

    if (t.saude === "ativo" || t.saude === "trial" || t.saude === "trial_expirando") {
      for (const n of t.nichos_ativos) {
        nichoMap.set(n, (nichoMap.get(n) ?? 0) + 1);
      }
    }
  }

  const emRisco = reais
    .filter(
      (t) =>
        t.saude === "trial_expirando" ||
        t.saude === "trial_expirado" ||
        t.saude === "suspenso"
    )
    .slice(0, 12);

  const recentes = reais
    .filter((t) => t.saude !== "inativo")
    .slice(0, 8);

  return {
    total_empresas: reais.length,
    ativos: reais.filter((t) => t.saude === "ativo").length,
    trials: reais.filter((t) => t.saude === "trial" || t.saude === "trial_expirando").length,
    trials_expirando: reais.filter((t) => t.saude === "trial_expirando").length,
    trials_expirados: reais.filter((t) => t.saude === "trial_expirado").length,
    suspensos: reais.filter((t) => t.saude === "suspenso").length,
    mrr_estimado: Math.round(mrrPago * 100) / 100,
    mrr_potencial: Math.round(mrrPotencial * 100) / 100,
    arr_estimado: Math.round(mrrPago * 12 * 100) / 100,
    arpu: ativosPagantes.length ? mrrPago / ativosPagantes.length : 0,
    novos_7d: reais.filter((t) => new Date(t.created_at).getTime() >= d7).length,
    novos_30d: reais.filter((t) => new Date(t.created_at).getTime() >= d30).length,
    suporte_humano_aberto: suporteHumanoAberto,
    onboarding_incompleto: reais.filter((t) => !t.onboarding_completo).length,
    orfas_ocultas: orfas.length,
    por_faixa: Array.from(faixaMap.entries()).map(([faixa, v]) => ({
      faixa,
      count: v.count,
      mrr: v.mrr,
    })),
    por_nicho: Array.from(nichoMap.entries())
      .map(([nicho, count]) => ({ nicho, count }))
      .sort((a, b) => b.count - a.count),
    recentes,
    em_risco: emRisco,
  };
}
