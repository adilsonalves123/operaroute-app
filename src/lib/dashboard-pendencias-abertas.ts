import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import {
  saldoPendenciaCobravel,
  saldoPendenciaReais,
} from "@/lib/nichos/cassino/pendencias";

export type PendenciaAbertaRow = {
  id?: string | null;
  tipo: string | null;
  titulo: string | null;
  valor: number | null;
  descricao?: string | null;
  visita_id: string | null;
  coleta_id: string | null;
};

export type PendenciasPorNicho = {
  cassinoPendente: number;
  cassinoHaver: number;
  furaPendente: number;
  furaHaver: number;
  ursinhoPendente: number;
  ursinhoHaver: number;
  diversaoPendente: number;
  diversaoHaver: number;
  bolinhaPendente: number;
  bolinhaHaver: number;
  consignadoPendente: number;
  consignadoHaver: number;
  /** Dívida universal (visita ao ponto consolidada) — não ratear por nicho. */
  pontoPendente: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type NichoPendenciaKey =
  | "fura_debt"
  | "fura_haver"
  | "cassino_debt"
  | "cassino_haver"
  | "ursinho_debt"
  | "ursinho_haver"
  | "diversao_debt"
  | "diversao_haver"
  | "bolinha_debt"
  | "bolinha_haver"
  | "consignado_debt"
  | "consignado_haver"
  | "ponto_debt"
  | "ignore";

function classificarPendencia(p: PendenciaAbertaRow): NichoPendenciaKey {
  const titulo = (p.titulo ?? "").toLowerCase();
  const tipo = (p.tipo ?? "").toLowerCase();
  const isHaver = tipo === "haver";

  // Pendência universal de visita multi-nicho — não ratear como cassino.
  if (
    tipo === "visita_consolidada" ||
    titulo.includes("visita ao ponto") ||
    (tipo === "parcial" && titulo.includes("visita"))
  ) {
    return "ponto_debt";
  }

  const isFura = titulo.includes("fura-fura") || titulo.includes("fura fura");
  const isUrsinho = titulo.includes("ursinho");
  const isDiversao = titulo.includes("diversão") || titulo.includes("diversao");
  const isBolinha = titulo.includes("bolinha");
  const isConsignado =
    titulo.includes("consignado") || titulo.includes("recolhe consignado");

  if (isHaver) {
    if (isFura) return "fura_haver";
    if (isUrsinho) return "ursinho_haver";
    if (isDiversao) return "diversao_haver";
    if (isBolinha) return "bolinha_haver";
    if (isConsignado) return "consignado_haver";
    return "cassino_haver";
  }

  if (isFura) return "fura_debt";
  if (isUrsinho) return "ursinho_debt";
  if (isDiversao) return "diversao_debt";
  if (isBolinha) return "bolinha_debt";
  if (isConsignado) return "consignado_debt";

  if (p.visita_id) return "cassino_debt";
  if (titulo.includes("visita") || titulo.includes("operação") || titulo.includes("operacao")) {
    return "cassino_debt";
  }
  // "Coleta X pendente" sem nicho claro — não misturar no cassino
  if (titulo.includes("coleta")) return "ignore";

  return "ignore";
}

function valorAberto(p: PendenciaAbertaRow): number {
  const tipo = (p.tipo ?? "").toLowerCase();
  if (tipo === "haver") {
    return saldoPendenciaReais({
      id: p.id ?? "",
      valor: Number(p.valor ?? 0),
      observacao: p.descricao,
    });
  }
  return saldoPendenciaCobravel({
    tipo: p.tipo ?? "",
    id: p.id ?? "",
    valor: Number(p.valor ?? 0),
    observacao: p.descricao,
  });
}

export function somarPendenciasPorNicho(rows: PendenciaAbertaRow[]): PendenciasPorNicho {
  const out: PendenciasPorNicho = {
    cassinoPendente: 0,
    cassinoHaver: 0,
    furaPendente: 0,
    furaHaver: 0,
    ursinhoPendente: 0,
    ursinhoHaver: 0,
    diversaoPendente: 0,
    diversaoHaver: 0,
    bolinhaPendente: 0,
    bolinhaHaver: 0,
    consignadoPendente: 0,
    consignadoHaver: 0,
    pontoPendente: 0,
  };

  for (const p of rows) {
    const valor = valorAberto(p);
    if (valor <= 0.009) continue;

    switch (classificarPendencia(p)) {
      case "cassino_debt":
        out.cassinoPendente += valor;
        break;
      case "cassino_haver":
        out.cassinoHaver += valor;
        break;
      case "fura_debt":
        out.furaPendente += valor;
        break;
      case "fura_haver":
        out.furaHaver += valor;
        break;
      case "ursinho_debt":
        out.ursinhoPendente += valor;
        break;
      case "ursinho_haver":
        out.ursinhoHaver += valor;
        break;
      case "diversao_debt":
        out.diversaoPendente += valor;
        break;
      case "diversao_haver":
        out.diversaoHaver += valor;
        break;
      case "bolinha_debt":
        out.bolinhaPendente += valor;
        break;
      case "bolinha_haver":
        out.bolinhaHaver += valor;
        break;
      case "consignado_debt":
        out.consignadoPendente += valor;
        break;
      case "consignado_haver":
        out.consignadoHaver += valor;
        break;
      case "ponto_debt":
        out.pontoPendente += valor;
        break;
      default:
        break;
    }
  }

  for (const key of Object.keys(out) as (keyof PendenciasPorNicho)[]) {
    out[key] = round2(out[key]);
  }
  return out;
}

export const fetchPendenciasAbertas = cache(async (
  supabase: SupabaseClient,
  empresaId: string
): Promise<PendenciaAbertaRow[]> => {
  const { data } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, descricao, visita_id, coleta_id")
    .eq("empresa_id", empresaId)
    .eq("status", "aberta");

  return (data ?? []) as PendenciaAbertaRow[];
});
