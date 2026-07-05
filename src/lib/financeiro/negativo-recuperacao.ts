import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";
import { dataNoPeriodo, type PeriodoFiltro } from "./periodo";

export type PontoNegativoResumo = {
  pontoId: string;
  pontoNome: string;
  recuperadoPeriodo: number;
  emAberto: number;
};

export function parsePeriodoFiltro(raw: string | undefined): PeriodoFiltro {
  if (raw === "7d" || raw === "30d" || raw === "tudo") return raw;
  return "hoje";
}

export function agregarNegativosPorPonto(
  visitas: {
    ponto_id: string | null;
    debito_abatido: number | null;
    created_at: string;
    pontos: { nome: string } | null;
  }[],
  pendencias: {
    id: string;
    ponto_id: string | null;
    valor: number | null;
    descricao: string | null;
    pontos: { nome: string } | null;
  }[],
  periodo: PeriodoFiltro
): PontoNegativoResumo[] {
  const map = new Map<string, PontoNegativoResumo>();

  for (const v of visitas) {
    if (!v.ponto_id) continue;
    const recuperado = Number(v.debito_abatido ?? 0);
    if (recuperado <= 0.009 || !dataNoPeriodo(v.created_at, periodo)) continue;

    const atual = map.get(v.ponto_id) ?? {
      pontoId: v.ponto_id,
      pontoNome: v.pontos?.nome ?? "Ponto",
      recuperadoPeriodo: 0,
      emAberto: 0,
    };
    atual.recuperadoPeriodo += recuperado;
    map.set(v.ponto_id, atual);
  }

  for (const p of pendencias) {
    if (!p.ponto_id) continue;
    const saldo = saldoPendenciaReais({
      id: p.id,
      valor: Number(p.valor ?? 0),
      observacao: p.descricao,
    });
    if (saldo <= 0.009) continue;

    const atual = map.get(p.ponto_id) ?? {
      pontoId: p.ponto_id,
      pontoNome: p.pontos?.nome ?? "Ponto",
      recuperadoPeriodo: 0,
      emAberto: 0,
    };
    atual.emAberto += saldo;
    map.set(p.ponto_id, atual);
  }

  return [...map.values()]
    .filter((p) => p.recuperadoPeriodo > 0.009 || p.emAberto > 0.009)
    .sort((a, b) => b.emAberto - a.emAberto || b.recuperadoPeriodo - a.recuperadoPeriodo);
}
