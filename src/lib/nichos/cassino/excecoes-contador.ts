export type ExcecaoContadorTipo = "reset_contador" | "manutencao" | "troca_placa";

export const EXCECAO_CONTADOR_OPCOES: {
  id: ExcecaoContadorTipo;
  label: string;
  descricao: string;
}[] = [
  {
    id: "reset_contador",
    label: "Contador zerou / resetou",
    descricao: "A máquina foi zerada ou reiniciada — a leitura atual pode ser menor que a anterior.",
  },
  {
    id: "manutencao",
    label: "Manutenção recente",
    descricao: "Houve manutenção que alterou ou substitiu o painel de contadores.",
  },
  {
    id: "troca_placa",
    label: "Troca de placa / equipamento",
    descricao: "Placa ou equipamento foi trocado — contadores não continuam da leitura anterior.",
  },
];

export function isRegressaoContador(args: {
  entradaAtual: number;
  entradaAnterior: number;
  saidaAtual: number;
  saidaAnterior: number;
}): boolean {
  return (
    args.entradaAtual < args.entradaAnterior || args.saidaAtual < args.saidaAnterior
  );
}

export function excecaoJustificaRegressao(excecao: ExcecaoContadorTipo | null | undefined): boolean {
  return excecao === "reset_contador" || excecao === "manutencao" || excecao === "troca_placa";
}

export function flagsIndicamRegressao(flags: string[]): boolean {
  return flags.some(
    (f) => f === "entrada_menor_que_anterior" || f === "saida_menor_que_anterior"
  );
}

/** Remove bloqueio automático por regressão quando há exceção válida ou manutenção recente. */
export function ajustarFlagsRegressao(args: {
  flags: string[];
  excecaoContador?: ExcecaoContadorTipo | null;
  manutencaoRecente?: boolean;
}): string[] {
  const next = new Set(args.flags);
  const justifica =
    excecaoJustificaRegressao(args.excecaoContador) || Boolean(args.manutencaoRecente);

  if (!justifica) return args.flags;

  if (args.excecaoContador) {
    next.add(`excecao_${args.excecaoContador}`);
  }
  if (args.manutencaoRecente) {
    next.add("manutencao_recente_detectada");
  }
  return Array.from(next);
}

export function regressaoPermiteRevisao(args: {
  excecaoContador?: ExcecaoContadorTipo | null;
  manutencaoRecente?: boolean;
}): boolean {
  return excecaoJustificaRegressao(args.excecaoContador) || Boolean(args.manutencaoRecente);
}

export type ManutencaoRecenteResumo = {
  detectada: boolean;
  chamadoId: string | null;
  status: string | null;
  titulo: string | null;
  diasDesdeAbertura: number | null;
};

/** Janela em dias para considerar manutenção recente no equipamento. */
export const MANUTENCAO_RECENTE_DIAS = 30;
