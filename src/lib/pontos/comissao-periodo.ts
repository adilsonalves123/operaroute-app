import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LABEL_COMISSAO_NICHO,
  chaveComissaoNicho,
  type NichoComissaoKey,
} from "@/lib/pontos/comissao-nicho";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ComissaoPontoPeriodoLinha = {
  nicho: string;
  label: string;
  valor: number;
};

export type ComissaoPontoPeriodo = {
  total: number;
  porNicho: ComissaoPontoPeriodoLinha[];
};

/**
 * Comissão que o ponto ganhou no período.
 * Cassino: visitas.valor_cliente (evita somar máquina a máquina).
 * Demais nichos: coletas.valor_comissao sem visita_id de cassino.
 */
export async function fetchComissaoPontoPeriodo(
  supabase: SupabaseClient,
  empresaId: string,
  pontoId: string,
  inicioISO: string,
  fimISO: string
): Promise<ComissaoPontoPeriodo> {
  const vazio: ComissaoPontoPeriodo = { total: 0, porNicho: [] };

  try {
    const [{ data: visitas }, { data: coletas }] = await Promise.all([
      supabase
        .from("visitas")
        .select("valor_cliente")
        .eq("empresa_id", empresaId)
        .eq("ponto_id", pontoId)
        .gte("created_at", inicioISO)
        .lte("created_at", fimISO),
      supabase
        .from("coletas")
        .select("valor_comissao, nicho_modulo, visita_id")
        .eq("empresa_id", empresaId)
        .eq("ponto_id", pontoId)
        .gte("created_at", inicioISO)
        .lte("created_at", fimISO)
        .is("visita_id", null),
    ]);

    const porNicho = new Map<string, number>();

    let cassino = 0;
    for (const v of visitas ?? []) {
      cassino += Number(v.valor_cliente ?? 0);
    }
    if (cassino > 0.0001) {
      porNicho.set("maquinas_cassino", round2(cassino));
    }

    for (const c of coletas ?? []) {
      const valor = Number(c.valor_comissao ?? 0);
      if (valor < 0.0001) continue;
      const key = chaveComissaoNicho(String(c.nicho_modulo ?? "outros")) ?? "outros";
      porNicho.set(key, round2((porNicho.get(key) ?? 0) + valor));
    }

    const linhas: ComissaoPontoPeriodoLinha[] = [...porNicho.entries()]
      .map(([nicho, valor]) => ({
        nicho,
        label:
          LABEL_COMISSAO_NICHO[nicho as NichoComissaoKey] ??
          (nicho === "outros" ? "Outros" : nicho),
        valor,
      }))
      .filter((l) => l.valor > 0.0001)
      .sort((a, b) => b.valor - a.valor);

    const total = round2(linhas.reduce((s, l) => s + l.valor, 0));

    return { total, porNicho: linhas };
  } catch {
    return vazio;
  }
}
