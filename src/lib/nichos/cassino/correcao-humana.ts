import { parseContadorInput } from "@/lib/nichos/cassino/contadores";
import type { ExcecaoContadorTipo } from "@/lib/nichos/cassino/excecoes-contador";

export type CorrecaoHumanaPayload = {
  tipo: "confirmacao_direta" | "alternativa" | "manual" | "excecao_registro";
  entrada_sugerida: string | null;
  saida_sugerida: string | null;
  entrada_final: string;
  saida_final: string;
  campos_alterados: ("entrada" | "saida")[];
  alternativa_entrada: boolean;
  alternativa_saida: boolean;
  revisao_obrigatoria: boolean;
  score: number | null;
  status_ia: string | null;
  flags: string[];
  excecao_contador: ExcecaoContadorTipo | null;
  motivo_excecao: string | null;
};

export function buildCorrecaoHumana(args: {
  entradaSugerida: string | null;
  saidaSugerida: string | null;
  entradaFinal: string;
  saidaFinal: string;
  alternativas?: { entrada: string[]; saida: string[] } | null;
  revisaoObrigatoria?: boolean;
  score?: number | null;
  statusIa?: string | null;
  flags?: string[];
  excecaoContador?: ExcecaoContadorTipo | null;
}): CorrecaoHumanaPayload {
  const entradaFinal = args.entradaFinal.trim();
  const saidaFinal = args.saidaFinal.trim();
  const entradaSugerida = args.entradaSugerida?.trim() || null;
  const saidaSugerida = args.saidaSugerida?.trim() || null;

  const altEntrada = new Set(args.alternativas?.entrada ?? []);
  const altSaida = new Set(args.alternativas?.saida ?? []);

  const camposAlterados: ("entrada" | "saida")[] = [];
  if (entradaSugerida && entradaFinal !== entradaSugerida) camposAlterados.push("entrada");
  if (saidaSugerida && saidaFinal !== saidaSugerida) camposAlterados.push("saida");

  const alternativaEntrada = Boolean(entradaFinal && altEntrada.has(entradaFinal));
  const alternativaSaida = Boolean(saidaFinal && altSaida.has(saidaFinal));

  let tipo: CorrecaoHumanaPayload["tipo"] = "confirmacao_direta";
  if (args.excecaoContador) {
    tipo = "excecao_registro";
  } else if (alternativaEntrada || alternativaSaida) {
    tipo = "alternativa";
  } else if (camposAlterados.length > 0 || args.revisaoObrigatoria) {
    tipo = "manual";
  }

  const excecao = args.excecaoContador ?? null;
  const motivoExcecao =
    excecao === "reset_contador"
      ? "Contador zerou ou foi resetado"
      : excecao === "manutencao"
        ? "Manutenção recente no equipamento"
        : excecao === "troca_placa"
          ? "Troca de placa ou equipamento"
          : null;

  return {
    tipo,
    entrada_sugerida: entradaSugerida,
    saida_sugerida: saidaSugerida,
    entrada_final: entradaFinal,
    saida_final: saidaFinal,
    campos_alterados: camposAlterados,
    alternativa_entrada: alternativaEntrada,
    alternativa_saida: alternativaSaida,
    revisao_obrigatoria: Boolean(args.revisaoObrigatoria),
    score: args.score ?? null,
    status_ia: args.statusIa ?? null,
    flags: args.flags ?? [],
    excecao_contador: excecao,
    motivo_excecao: motivoExcecao,
  };
}

export function correcaoIndicaManual(payload: CorrecaoHumanaPayload | null | undefined): boolean {
  if (!payload) return false;
  if (payload.excecao_contador) return true;
  if (payload.tipo === "manual" || payload.tipo === "alternativa" || payload.tipo === "excecao_registro") {
    return true;
  }
  if (payload.campos_alterados.length > 0) return true;
  return payload.revisao_obrigatoria;
}

/** Compara centésimos finais com sugestão da IA. */
export function valoresDivergemDaSugestao(args: {
  entradaSugerida: string | null;
  saidaSugerida: string | null;
  entradaFinal: string;
  saidaFinal: string;
}): boolean {
  const entSug = args.entradaSugerida ? parseContadorInput(args.entradaSugerida) : null;
  const saiSug = args.saidaSugerida ? parseContadorInput(args.saidaSugerida) : null;
  const entFin = parseContadorInput(args.entradaFinal);
  const saiFin = parseContadorInput(args.saidaFinal);
  if (entSug != null && entSug > 0 && entFin !== entSug) return true;
  if (saiSug != null && saiSug > 0 && saiFin !== saiSug) return true;
  return false;
}
