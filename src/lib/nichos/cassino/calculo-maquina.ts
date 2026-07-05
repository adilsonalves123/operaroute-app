import { validarLeitura, parseContadorInput } from "./contadores";
import type { LeituraMaquinaInput, MaquinaCalculo } from "./types";

export interface ErrosLeituraMaquina {
  entrada?: string;
  saida?: string;
}

export function validarLeiturasMaquina(input: {
  entradaAnterior: number;
  saidaAnterior: number;
  entradaAtualInput: string;
  saidaAtualInput: string;
  exigirPreenchimento?: boolean;
}): ErrosLeituraMaquina {
  const erros: ErrosLeituraMaquina = {};

  if (input.exigirPreenchimento && !input.entradaAtualInput.trim()) {
    erros.entrada = "Informe a entrada atual";
  } else if (input.entradaAtualInput.trim()) {
    const err = validarLeitura(
      input.entradaAnterior,
      parseContadorInput(input.entradaAtualInput),
      "Entrada"
    );
    if (err) erros.entrada = err;
  }

  if (input.exigirPreenchimento && !input.saidaAtualInput.trim()) {
    erros.saida = "Informe a saída atual";
  } else if (input.saidaAtualInput.trim()) {
    const err = validarLeitura(
      input.saidaAnterior,
      parseContadorInput(input.saidaAtualInput),
      "Saída"
    );
    if (err) erros.saida = err;
  }

  return erros;
}

export function temErrosLeitura(erros: ErrosLeituraMaquina): boolean {
  return Boolean(erros.entrada || erros.saida);
}

export function calcularMaquina(input: LeituraMaquinaInput): MaquinaCalculo {
  const errEntrada = validarLeitura(
    input.entradaAnterior,
    input.entradaAtual,
    "Entrada"
  );
  if (errEntrada) throw new Error(errEntrada);

  const errSaida = validarLeitura(input.saidaAnterior, input.saidaAtual, "Saída");
  if (errSaida) throw new Error(errSaida);

  const entradaPeriodo = input.entradaAtual - input.entradaAnterior;
  const saidaPeriodo = input.saidaAtual - input.saidaAnterior;
  const lucroCentavos = entradaPeriodo - saidaPeriodo;

  return {
    equipamentoId: input.equipamentoId,
    nome: input.nome,
    entradaAnterior: input.entradaAnterior,
    saidaAnterior: input.saidaAnterior,
    entradaAtual: input.entradaAtual,
    saidaAtual: input.saidaAtual,
    entradaPeriodo,
    saidaPeriodo,
    lucroCentavos,
    fotoUri: input.fotoUri,
  };
}

export function calcularTotaisVisita(maquinas: MaquinaCalculo[]) {
  return {
    totalEntradaPeriodo: maquinas.reduce((s, m) => s + m.entradaPeriodo, 0),
    totalSaidaPeriodo: maquinas.reduce((s, m) => s + m.saidaPeriodo, 0),
    totalLucroCentavos: maquinas.reduce((s, m) => s + m.lucroCentavos, 0),
  };
}
