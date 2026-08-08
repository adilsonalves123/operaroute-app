import type { SupabaseClient } from "@supabase/supabase-js";
import { centesimosToReais } from "@/lib/nichos/cassino";
import { fetchVisitaPontoResumo } from "@/lib/visitas-ponto/resumo";
import {
  comprovantePublicUrl,
  gerarTokenComprovante,
  type ComprovanteSnapshot,
} from "@/lib/comprovantes/types";
import { snapshotFromVisitaPonto } from "@/lib/comprovantes/from-visita-ponto";

export { snapshotFromVisitaPonto } from "@/lib/comprovantes/from-visita-ponto";

export type CriarComprovanteVisitaPontoInput = {
  empresaId: string;
  visitaPontoId: string;
  previa?: boolean;
  dividaSaldo?: number;
  desconto?: number;
  pix?: number;
  dinheiro?: number;
  haverSaldo?: number;
  descontarHaver?: boolean;
  nomeOperacao?: string | null;
  chavePix?: string | null;
  /** Se a reconsulta no banco falhar, grava este payload (já montado na UI). */
  snapshotFallback?: ComprovanteSnapshot | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type CriarComprovanteCassinoInput = {
  empresaId: string;
  visitaId: string;
  previa?: boolean;
  nomeOperacao?: string | null;
  chavePix?: string | null;
  snapshotFallback?: ComprovanteSnapshot | null;
};

async function ensureEmpresaBrand(
  supabase: SupabaseClient,
  empresaId: string,
  fallbackNome?: string | null,
  fallbackPix?: string | null
): Promise<{ nome: string; chavePix: string | null }> {
  const { data } = await supabase
    .from("empresas")
    .select("nome_operacao, chave_pix")
    .eq("id", empresaId)
    .maybeSingle();

  return {
    nome:
      (fallbackNome ?? "").trim() ||
      (data?.nome_operacao ?? "").trim() ||
      "Operação",
    chavePix:
      (fallbackPix ?? "").trim() ||
      (data?.chave_pix ?? "").trim() ||
      null,
  };
}

async function upsertComprovante(
  supabase: SupabaseClient,
  row: {
    empresaId: string;
    visitaPontoId?: string | null;
    visitaId?: string | null;
    previa: boolean;
    snapshot: ComprovanteSnapshot;
  }
): Promise<{ token: string; url: string }> {
  const hasRef = Boolean(row.visitaPontoId || row.visitaId);

  // Reutiliza token ativo da mesma referência (evita spam de links).
  if (hasRef) {
    let existingQuery = supabase
      .from("public_comprovantes")
      .select("token")
      .eq("empresa_id", row.empresaId)
      .eq("previa", row.previa)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (row.visitaPontoId) {
      existingQuery = existingQuery.eq("visita_ponto_id", row.visitaPontoId);
    } else {
      existingQuery = existingQuery.eq("visita_id", row.visitaId!);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing?.token) {
      await supabase
        .from("public_comprovantes")
        .update({
          snapshot: row.snapshot,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("token", existing.token)
        .eq("empresa_id", row.empresaId);

      return { token: existing.token, url: comprovantePublicUrl(existing.token) };
    }
  }

  const token = gerarTokenComprovante();
  const { error } = await supabase.from("public_comprovantes").insert({
    token,
    empresa_id: row.empresaId,
    visita_ponto_id: row.visitaPontoId ?? null,
    visita_id: row.visitaId ?? null,
    previa: row.previa,
    snapshot: row.snapshot,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    const detail = error.message || error.code || "erro desconhecido";
    throw new Error(`Falha ao gravar comprovante: ${detail}`);
  }

  return { token, url: comprovantePublicUrl(token) };
}

export async function criarComprovanteVisitaPonto(
  supabase: SupabaseClient,
  input: CriarComprovanteVisitaPontoInput
): Promise<{ token: string; url: string; snapshot: ComprovanteSnapshot }> {
  const brand = await ensureEmpresaBrand(
    supabase,
    input.empresaId,
    input.nomeOperacao,
    input.chavePix
  );

  let snapshot: ComprovanteSnapshot | null = null;
  const resumo = await fetchVisitaPontoResumo(
    supabase,
    input.empresaId,
    input.visitaPontoId
  );

  if (resumo) {
    snapshot = snapshotFromVisitaPonto(resumo, {
      previa: input.previa,
      dividaSaldo: input.dividaSaldo,
      desconto: input.desconto,
      pix: input.pix,
      dinheiro: input.dinheiro,
      haverSaldo: input.haverSaldo,
      descontarHaver: input.descontarHaver,
      nomeOperacao: brand.nome,
      chavePix: brand.chavePix,
    });
  } else if (input.snapshotFallback?.pontoNome) {
    // UI já tinha o resumo; evita falso "não encontrada" (join/RLS/admin).
    snapshot = {
      ...input.snapshotFallback,
      previa: input.previa === true,
      empresaNome: brand.nome || input.snapshotFallback.empresaNome,
      chavePix: brand.chavePix ?? input.snapshotFallback.chavePix,
    };
  } else {
    throw new Error(
      `Visita ao ponto não encontrada (id ${String(input.visitaPontoId).slice(0, 8)}…). Atualize a página e tente de novo.`
    );
  }

  const out = await upsertComprovante(supabase, {
    empresaId: input.empresaId,
    visitaPontoId: input.visitaPontoId,
    previa: input.previa === true,
    snapshot,
  });

  return { ...out, snapshot };
}

export async function criarComprovanteCassino(
  supabase: SupabaseClient,
  input: CriarComprovanteCassinoInput
): Promise<{ token: string; url: string; snapshot: ComprovanteSnapshot }> {
  const visitaId = String(input.visitaId ?? "").trim();
  if (!visitaId) {
    throw new Error("ID da coleta cassino não informado.");
  }

  // 1) Por id (service role). 2) Com filtro de empresa. Evita falso "não encontrada".
  let visita: {
    id: string;
    ponto_id: string;
    empresa_id: string;
    created_at: string;
    valor_pago: number | null;
    restante: number | null;
    valor_operacao_efetivo: number | null;
    valor_operacao: number | null;
    valor_cliente: number | null;
    desconto: number | null;
    desconto_recebimento: number | null;
    saldo_negativo: boolean | null;
    total_lucro_centavos: number | null;
    debito_abatido: number | null;
  } | null = null;

  const { data: byId, error: errById } = await supabase
    .from("visitas")
    .select(
      "id, ponto_id, empresa_id, created_at, valor_pago, restante, valor_operacao_efetivo, valor_operacao, valor_cliente, desconto, desconto_recebimento, saldo_negativo, total_lucro_centavos, debito_abatido"
    )
    .eq("id", visitaId)
    .maybeSingle();

  if (errById) {
    // Coluna ausente / schema: tenta select mínimo
    const { data: minimal, error: errMin } = await supabase
      .from("visitas")
      .select("id, ponto_id, empresa_id, created_at, valor_pago, restante, valor_operacao, desconto, saldo_negativo, total_lucro_centavos")
      .eq("id", visitaId)
      .maybeSingle();
    if (errMin) {
      if (input.snapshotFallback) {
        const out = await upsertComprovante(supabase, {
          empresaId: input.empresaId,
          visitaId: null,
          previa: input.previa === true,
          snapshot: input.snapshotFallback,
        });
        return { ...out, snapshot: input.snapshotFallback };
      }
      throw new Error(errMin.message || errById.message);
    }
    visita = minimal
      ? {
          ...minimal,
          valor_operacao_efetivo: minimal.valor_operacao,
          valor_cliente: null,
          desconto_recebimento: 0,
          debito_abatido: null,
        }
      : null;
  } else {
    visita = byId;
  }

  if (visita && visita.empresa_id && visita.empresa_id !== input.empresaId) {
    throw new Error("Coleta cassino de outra empresa.");
  }

  if (!visita) {
    if (input.snapshotFallback) {
      const out = await upsertComprovante(supabase, {
        empresaId: input.empresaId,
        visitaId: null,
        previa: input.previa === true,
        snapshot: input.snapshotFallback,
      });
      return { ...out, snapshot: input.snapshotFallback };
    }
    throw new Error(
      `Coleta cassino não encontrada (id ${visitaId.slice(0, 8)}…). Confira se a coleta salvou e tente de novo.`
    );
  }

  const [{ data: ponto }, brand, { data: coletas }] = await Promise.all([
    supabase
      .from("pontos")
      .select("nome, comissao_percentual")
      .eq("id", visita.ponto_id)
      .maybeSingle(),
    ensureEmpresaBrand(supabase, input.empresaId, input.nomeOperacao, input.chavePix),
    supabase
      .from("coletas")
      .select("equipamento_id, lucro_centavos, entrada_atual, saida_atual")
      .eq("visita_id", visita.id),
  ]);

  const eqIds = [...new Set((coletas ?? []).map((c) => c.equipamento_id).filter(Boolean))];
  const { data: eqs } =
    eqIds.length > 0
      ? await supabase
          .from("equipamentos")
          .select("id, nome, numero_serie")
          .in("id", eqIds)
      : { data: [] as { id: string; nome: string | null; numero_serie: string | null }[] };
  const eqMap = new Map((eqs ?? []).map((e) => [e.id, e]));

  const valorPago = round2(Number(visita.valor_pago ?? 0));
  const restante = round2(Number(visita.restante ?? 0));
  const saldoNegativo = visita.saldo_negativo === true;
  const lucroCentavos = Number(visita.total_lucro_centavos ?? 0);
  const prejuizo = saldoNegativo
    ? round2(centesimosToReais(Math.abs(lucroCentavos)))
    : 0;
  const valorDeixado = saldoNegativo
    ? round2(Number(visita.desconto ?? 0))
    : 0;
  const valorOperacional = round2(
    Number(visita.valor_operacao ?? 0) ||
      (saldoNegativo ? 0 : centesimosToReais(lucroCentavos))
  );
  const comissao = round2(Number(visita.valor_cliente ?? 0));
  const comissaoPercentual = Number(ponto?.comissao_percentual ?? 0) || undefined;
  const subtotal = saldoNegativo
    ? 0
    : round2(
        Number(visita.valor_operacao_efetivo ?? visita.valor_operacao ?? 0) ||
          valorOperacional
      );
  const desconto = saldoNegativo
    ? 0
    : round2(
        Number(visita.desconto_recebimento ?? 0) + Number(visita.desconto ?? 0)
      );
  const totalACobrar = saldoNegativo
    ? 0
    : round2(Math.max(subtotal - desconto, valorPago + restante));

  const maquinas = (coletas ?? []).map((c) => {
    const eq = eqMap.get(c.equipamento_id);
    const nome =
      eq?.nome?.trim() || eq?.numero_serie?.trim() || "Máquina";
    const entrada = Number(c.entrada_atual ?? NaN);
    const saida = Number(c.saida_atual ?? NaN);
    return {
      nome,
      lucro: centesimosToReais(Number(c.lucro_centavos ?? 0)),
      ...(Number.isFinite(entrada) ? { entradaAtual: entrada } : {}),
      ...(Number.isFinite(saida) ? { saidaAtual: saida } : {}),
    };
  });

  const negativoRecuperado = saldoNegativo
    ? 0
    : round2(Number(visita.debito_abatido ?? 0));
  const negativoRestante =
    !saldoNegativo && negativoRecuperado > 0.009
      ? restante
      : 0;
  const negativoAnterior =
    !saldoNegativo && negativoRecuperado > 0.009
      ? round2(negativoRecuperado + negativoRestante)
      : 0;

  const snapshot: ComprovanteSnapshot = saldoNegativo
    ? {
        empresaNome: brand.nome,
        chavePix: brand.chavePix,
        pontoNome: ponto?.nome ?? "Ponto",
        dataIso: visita.created_at,
        previa: input.previa === true,
        nichos: [{ label: "Cassino", valor: round2(-prejuizo) }],
        maquinas,
        subtotal: 0,
        divida: 0,
        desconto: 0,
        haverAbatido: 0,
        totalACobrar: 0,
        valorPago,
        restante: 0,
        haverGerado: 0,
        saldoNegativo: true,
        prejuizo,
        valorDeixado,
        notas: ["Comissão bloqueada — recupera na próxima positiva"],
      }
    : {
        empresaNome: brand.nome,
        chavePix: brand.chavePix,
        pontoNome: ponto?.nome ?? "Ponto",
        dataIso: visita.created_at,
        previa: input.previa === true,
        nichos: [{ label: "Cassino", valor: subtotal }],
        maquinas,
        valorOperacional,
        comissao,
        comissaoPercentual,
        subtotal,
        divida: 0,
        desconto,
        haverAbatido: 0,
        totalACobrar,
        valorPago,
        restante,
        haverGerado: 0,
        totalBruto: totalACobrar,
        negativoAnterior,
        negativoRecuperado,
        negativoRestante,
      };

  const out = await upsertComprovante(supabase, {
    empresaId: input.empresaId,
    visitaId: visita.id,
    previa: input.previa === true,
    snapshot,
  });

  return { ...out, snapshot };
}

export async function carregarComprovantePorToken(
  admin: SupabaseClient,
  token: string
): Promise<{
  snapshot: ComprovanteSnapshot;
  previa: boolean;
  expiresAt: string | null;
} | null> {
  const clean = token.trim();
  if (!clean || clean.length < 8) return null;

  const { data } = await admin
    .from("public_comprovantes")
    .select("snapshot, previa, expires_at, revoked_at")
    .eq("token", clean)
    .maybeSingle();

  if (!data || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  const snapshot = data.snapshot as ComprovanteSnapshot | null;
  if (!snapshot?.pontoNome) return null;

  void admin
    .from("public_comprovantes")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("token", clean);

  return {
    snapshot,
    previa: data.previa === true,
    expiresAt: data.expires_at ?? null,
  };
}
