import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarNumeroSerie } from "@/lib/equipamentos/numero-serie";

export type SerieEmUso = {
  id: string;
  numero_serie: string | null;
  ponto_id: string | null;
  status: string | null;
  nome: string | null;
  numero_maquina: string | null;
  ponto_nome: string | null;
};

/**
 * Procura outra ficha com a mesma série (normalizada) na empresa.
 * `excetoEquipamentoId` = edição da própria máquina.
 */
export async function encontrarSerieEmUso(
  supabase: SupabaseClient,
  empresaId: string,
  serieRaw: string,
  opts?: { excetoEquipamentoId?: string | null }
): Promise<SerieEmUso | null> {
  const serieNorm = normalizarNumeroSerie(serieRaw);
  if (!serieNorm) return null;

  const { data } = await supabase
    .from("equipamentos")
    .select("id, numero_serie, ponto_id, status, nome, numero_maquina, pontos(nome)")
    .eq("empresa_id", empresaId)
    .not("numero_serie", "is", null);

  const exceto = opts?.excetoEquipamentoId?.trim() || null;

  for (const row of data ?? []) {
    if (exceto && row.id === exceto) continue;
    if (normalizarNumeroSerie(String(row.numero_serie ?? "")) !== serieNorm) continue;

    const pontos = row.pontos as { nome: string } | { nome: string }[] | null | undefined;
    const pontoNome = Array.isArray(pontos) ? pontos[0]?.nome : pontos?.nome;

    return {
      id: row.id,
      numero_serie: row.numero_serie,
      ponto_id: row.ponto_id,
      status: row.status,
      nome: row.nome,
      numero_maquina: row.numero_maquina,
      ponto_nome: pontoNome ?? null,
    };
  }

  return null;
}

export function mensagemSerieJaCadastrada(
  serieDigitada: string,
  existente: SerieEmUso
): string {
  const serie = serieDigitada.trim() || existente.numero_serie || "—";
  const painel = existente.numero_maquina?.trim();
  const nome = existente.nome?.trim();
  const rotulo = [painel ? `Painel ${painel}` : null, nome].filter(Boolean).join(" · ");

  if (!existente.ponto_id) {
    return rotulo
      ? `Série "${serie}" já está no estoque (${rotulo}). Use “Trazer do estoque” em vez de cadastrar de novo.`
      : `Série "${serie}" já está no estoque. Use “Trazer do estoque” em vez de cadastrar de novo.`;
  }

  const onde = existente.ponto_nome?.trim() || "outro ponto";
  return rotulo
    ? `Série "${serie}" já está cadastrada em "${onde}" (${rotulo}). Transfira essa máquina em vez de criar outra.`
    : `Série "${serie}" já está cadastrada em "${onde}". Transfira essa máquina em vez de criar outra.`;
}

/** Detecta séries repetidas dentro do próprio lote (cadastro de ponto com várias máquinas). */
export function encontrarSerieDuplicadaNoLote(
  series: (string | null | undefined)[]
): string | null {
  const vistos = new Map<string, string>();
  for (const raw of series) {
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) continue;
    const norm = normalizarNumeroSerie(trimmed);
    if (!norm) continue;
    const anterior = vistos.get(norm);
    if (anterior) return trimmed;
    vistos.set(norm, trimmed);
  }
  return null;
}
