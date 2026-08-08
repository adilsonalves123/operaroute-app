import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanoByFaixa,
  limiteFromFaixa,
  maxNichosFromFaixa,
  NICHOS_PAGOS,
  normalizeFaixaPontos,
  PLANOS_PADRAO,
  slugFromFaixa,
  type FaixaPontos,
  type PlanoDefinicao,
} from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";
import {
  loadNichosPagosAtivos,
  mensagemNichosTravados,
  nichosRemovidosIndevidamente,
} from "@/lib/nichos/nicho-travado";

export type AplicarPlanoInput = {
  empresaId: string;
  nichos: Nicho[];
  quantidade_pontos: FaixaPontos | string;
  planos?: PlanoDefinicao[];
  /** Se true, também marca assinatura paga. */
  ativarAssinatura?: boolean;
  ciclo?: "mensal" | "anual";
  assinaturaVenceEm?: Date | null;
  /**
   * Só suporte/plataforma. Sem isso, nichos já ativos não podem ser removidos
   * (evita fraude de trocar nichos para usar vários no mesmo plano).
   */
  permitirTrocaTravados?: boolean;
};

export type AplicarPlanoResult =
  | {
      ok: true;
      nichos_ativos: Nicho[];
      quantidade_pontos: FaixaPontos;
      plano: string;
      limite_pontos: number;
      max_nichos: number;
    }
  | { ok: false; status: number; error: string; code?: string };

export async function aplicarPlanoEmpresa(
  supabase: SupabaseClient,
  input: AplicarPlanoInput
): Promise<AplicarPlanoResult> {
  const planos = input.planos ?? PLANOS_PADRAO;
  const pagosSelecionados = (input.nichos ?? []).filter((n) =>
    NICHOS_PAGOS.includes(n)
  );

  if (pagosSelecionados.length === 0) {
    return {
      ok: false,
      status: 400,
      error:
        "Selecione pelo menos um nicho (Fura Fura, Cassino, Ursinho, Diversão…).",
    };
  }

  const quantidadePontos = normalizeFaixaPontos(input.quantidade_pontos);
  const plano = getPlanoByFaixa(quantidadePontos, planos);
  const maxNichos = maxNichosFromFaixa(quantidadePontos, planos);
  const empresaId = input.empresaId;

  const nichosJaAtivos = await loadNichosPagosAtivos(supabase, empresaId);
  if (!input.permitirTrocaTravados) {
    const removidos = nichosRemovidosIndevidamente(
      nichosJaAtivos,
      pagosSelecionados
    );
    if (removidos.length > 0) {
      return {
        ok: false,
        status: 403,
        error: mensagemNichosTravados(removidos),
        code: "nicho_travado",
      };
    }
  }

  if (pagosSelecionados.length > maxNichos) {
    // Suporte pode ajustar acima do plano (ex.: cortesia / correção de escolha).
    if (!input.permitirTrocaTravados) {
      return {
        ok: false,
        status: 403,
        error: `O plano ${plano.nome} permite no máximo ${maxNichos} nicho(s).`,
        code: "nicho_limite",
      };
    }
  }

  const limitePontos = limiteFromFaixa(quantidadePontos, planos);
  const nichoPrincipal = pagosSelecionados[0]!;

  const { count: pontosAtivos } = await supabase
    .from("pontos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("status", "ativo");

  if ((pontosAtivos ?? 0) > limitePontos) {
    return {
      ok: false,
      status: 403,
      error: `Você tem ${pontosAtivos} pontos ativos. O plano ${plano.nome} permite até ${limitePontos === 9999 ? "ilimitados" : limitePontos}.`,
      code: "pontos_limite",
    };
  }

  const agora = new Date().toISOString();
  const rowsComConfirmacao = [
    ...NICHOS_PAGOS.map((nicho) => {
      const ativo = pagosSelecionados.includes(nicho);
      const jaEraAtivo = nichosJaAtivos.includes(nicho);
      return {
        empresa_id: empresaId,
        nicho,
        ativo,
        confirmado_em: ativo ? (jaEraAtivo ? undefined : agora) : null,
      };
    }),
    {
      empresa_id: empresaId,
      nicho: "outros" as Nicho,
      ativo: true,
      confirmado_em: null as string | null,
    },
  ];

  // Sem confirmado_em no payload dos que já eram ativos (não sobrescreve timestamp).
  const rows = rowsComConfirmacao.map((row) => {
    if (row.confirmado_em === undefined) {
      const { confirmado_em: _omit, ...rest } = row;
      return rest;
    }
    return row;
  });

  let { error: nichoError } = await supabase
    .from("empresa_nichos")
    .upsert(rows, { onConflict: "empresa_id,nicho" });

  // Coluna confirmado_em pode não existir ainda — tenta sem ela.
  if (
    nichoError &&
    String(nichoError.message).includes("confirmado_em")
  ) {
    const rowsSemColuna = NICHOS_PAGOS.map((nicho) => ({
      empresa_id: empresaId,
      nicho,
      ativo: pagosSelecionados.includes(nicho),
    })).concat([{ empresa_id: empresaId, nicho: "outros" as Nicho, ativo: true }]);
    ({ error: nichoError } = await supabase
      .from("empresa_nichos")
      .upsert(rowsSemColuna, { onConflict: "empresa_id,nicho" }));
  }

  if (nichoError) {
    const msg = nichoError.message ?? "";
    const tableMissing =
      /relation .*empresa_nichos.* does not exist/i.test(msg) ||
      (/empresa_nichos/i.test(msg) && /does not exist|schema cache/i.test(msg));
    return {
      ok: false,
      status: 500,
      error: tableMissing
        ? "Tabela empresa_nichos não existe. Rode supabase/fix-empresa-nichos-suporte.sql no Supabase SQL Editor."
        : msg,
    };
  }

  const updatePayload: Record<string, unknown> = {
    quantidade_pontos: quantidadePontos,
    limite_pontos: limitePontos,
    nicho: nichoPrincipal,
  };

  if (input.ciclo) {
    updatePayload.ciclo_cobranca = input.ciclo;
  }
  if (input.assinaturaVenceEm) {
    updatePayload.assinatura_vence_em = input.assinaturaVenceEm.toISOString();
  }

  try {
    updatePayload.plano = slugFromFaixa(quantidadePontos, planos);
  } catch {
    // ignore
  }

  let { error: empresaError } = await supabase
    .from("empresas")
    .update(updatePayload)
    .eq("id", empresaId);

  if (empresaError && String(empresaError.message).includes("plano")) {
    delete updatePayload.plano;
    ({ error: empresaError } = await supabase
      .from("empresas")
      .update(updatePayload)
      .eq("id", empresaId));
  }

  // Colunas novas podem não existir ainda — tenta sem elas
  if (
    empresaError &&
    (String(empresaError.message).includes("assinatura_vence_em") ||
      String(empresaError.message).includes("ciclo_cobranca"))
  ) {
    delete updatePayload.assinatura_vence_em;
    delete updatePayload.ciclo_cobranca;
    ({ error: empresaError } = await supabase
      .from("empresas")
      .update(updatePayload)
      .eq("id", empresaId));
  }

  if (empresaError) {
    return { ok: false, status: 500, error: empresaError.message };
  }

  if (input.ativarAssinatura) {
    const { error: profError } = await supabase
      .from("profiles")
      .update({ assinatura_ativa: true })
      .eq("empresa_id", empresaId);
    if (profError) {
      return { ok: false, status: 500, error: profError.message };
    }
  }

  return {
    ok: true,
    nichos_ativos: [...pagosSelecionados, "outros"],
    quantidade_pontos: quantidadePontos,
    plano: plano.nome,
    limite_pontos: limitePontos,
    max_nichos: maxNichos,
  };
}

export function calcVencimentoAssinatura(
  ciclo: "mensal" | "anual",
  from = new Date()
): Date {
  const d = new Date(from);
  if (ciclo === "anual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}
