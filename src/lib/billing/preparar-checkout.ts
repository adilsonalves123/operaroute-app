import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPrecosPayload } from "@/lib/dono/precos";
import {
  calcPrecoCiclo,
  getPlanoByFaixa,
  NICHOS_PAGOS,
  normalizeFaixaPontos,
  PLANOS_PADRAO,
  type FaixaPontos,
  type PlanoDefinicao,
} from "@/lib/pricing";
import type { Nicho } from "@/lib/types/database";
import {
  loadNichosPagosAtivos,
  mensagemNichosTravados,
  nichosRemovidosIndevidamente,
} from "@/lib/nichos/nicho-travado";

export type CheckoutBody = {
  nichos?: Nicho[];
  quantidade_pontos?: FaixaPontos | string;
  ciclo?: "mensal" | "anual";
};

export type CheckoutPreparado = {
  ciclo: "mensal" | "anual";
  faixa: FaixaPontos;
  plano: PlanoDefinicao;
  planos: PlanoDefinicao[];
  pagos: Nicho[];
  valor: number;
  valorCentavos: number;
  titulo: string;
};

/** Valida nichos/plano/preço do checkout (pagamento único ou assinatura no cartão). */
export async function prepararCheckout(
  admin: SupabaseClient,
  empresaId: string,
  body: CheckoutBody
): Promise<{ ok: true; dados: CheckoutPreparado } | { ok: false; response: NextResponse }> {
  const ciclo = body.ciclo === "anual" ? "anual" : "mensal";
  const precos = await loadPrecosPayload(admin);
  const planos = precos.planos?.length ? precos.planos : PLANOS_PADRAO;

  const pagos = (body.nichos ?? []).filter((n) => NICHOS_PAGOS.includes(n));
  if (pagos.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Selecione pelo menos um nicho." }, { status: 400 }),
    };
  }

  const nichosJaAtivos = await loadNichosPagosAtivos(admin, empresaId);
  const removidos = nichosRemovidosIndevidamente(nichosJaAtivos, pagos);
  if (removidos.length > 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: mensagemNichosTravados(removidos), code: "nicho_travado" },
        { status: 403 }
      ),
    };
  }

  const faixa = normalizeFaixaPontos(body.quantidade_pontos);
  const plano = getPlanoByFaixa(faixa, planos);
  if (pagos.length > plano.maxNichos) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `O plano ${plano.nome} permite no máximo ${plano.maxNichos} nicho(s).` },
        { status: 403 }
      ),
    };
  }

  const valor = calcPrecoCiclo(ciclo, faixa, pagos, planos, precos.multiplicador_anual);
  if (valor == null || valor <= 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Preço indisponível para este plano." },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true,
    dados: {
      ciclo,
      faixa,
      plano,
      planos,
      pagos,
      valor,
      valorCentavos: Math.round(valor * 100),
      titulo: `OperaRoute ${plano.nome} — ${ciclo}`,
    },
  };
}
