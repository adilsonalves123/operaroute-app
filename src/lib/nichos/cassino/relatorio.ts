import { formatContador, centesimosToReais } from "./contadores";
import { baseComissaoReais, comissaoBloqueada } from "./comissao";
import { hintMovimentoCaixa, valorMovimentoCaixa, type MovimentoCaixaDetalhe } from "./caixa";
import { displayOperacaoNegativa } from "./resumo-visita";
import { resumoTotalVisita, negativoFicaProximaColetaReais } from "./resumo-visita";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CalculoVisitaResult } from "./types";

export interface RelatorioMaquinaLinha {
  nome: string;
  entradaAnterior: number;
  saidaAnterior: number;
  entradaAtual: number;
  saidaAtual: number;
  lucroCentavos: number;
  fotoUrl?: string | null;
}

export interface RelatorioColetaData {
  empresaNome: string;
  pontoNome: string;
  pontoWhatsapp?: string | null;
  comissaoPercentual: number;
  data: Date;
  previa: boolean;
  maquinas: RelatorioMaquinaLinha[];
  calculo: CalculoVisitaResult;
  /** Detalhe Pix/dinheiro do adiantamento (visita negativa) */
  adiantamento?: AdiantamentoDetalhe;
}

export type AdiantamentoDetalhe = MovimentoCaixaDetalhe;

export function hintAdiantamento(a: AdiantamentoDetalhe): string | undefined {
  return hintMovimentoCaixa(a, "saida");
}

export function valorSaidaCaixaAdiantamento(a: AdiantamentoDetalhe): number {
  return valorMovimentoCaixa(a);
}

export type ResumoFinanceiroVariant =
  | "default"
  | "discount"
  | "highlight"
  | "warning"
  | "muted";

export interface ResumoFinanceiroLinha {
  label: string;
  valor: string;
  variant?: ResumoFinanceiroVariant;
  hint?: string;
  dividerBefore?: boolean;
  /** Cabeçalho de seção — valor omitido na renderização */
  secao?: boolean;
  destaque?: boolean;
}

interface BuildResumoFinanceiroOptions {
  clientFacing?: boolean;
}

function hintBaseComissaoPositiva(c: CalculoVisitaResult): string | undefined {
  const partes: string[] = [];
  if (c.recuperacaoNegativoReais > 0.009) {
    partes.push(`negativo ${formatCurrency(c.recuperacaoNegativoReais)}`);
  }
  if (c.haverCompensadoReais > 0.009) {
    partes.push(`haver ${formatCurrency(c.haverCompensadoReais)}`);
  }
  if (partes.length === 0) return undefined;
  return `Lucro − ${partes.join(" − ")}`;
}

/** Visita positiva — seções enxutas (evita repetir negativo/base/pagamento). */
function buildResumoFinanceiroPositivo(
  c: CalculoVisitaResult,
  comissaoPercentual: number
): ResumoFinanceiroLinha[] {
  const linhas: ResumoFinanceiroLinha[] = [
    {
      label: "Total entrada / Total saída",
      valor: `${formatContador(c.totalEntradaPeriodo)} / ${formatContador(c.totalSaidaPeriodo)}`,
    },
    {
      label: "Lucro da visita",
      valor: formatContador(c.totalLucroCentavos),
    },
  ];

  const base = baseComissaoReais(c);
  const hintBase = hintBaseComissaoPositiva(c);
  if (hintBase && base > 0.009) {
    linhas.push({
      label: "Base para comissão",
      valor: formatCurrency(base),
      hint: hintBase,
    });
  }

  linhas.push(
    {
      label: comissaoBloqueada(c)
        ? "Comissão bloqueada"
        : `Comissão (${comissaoPercentual}%)`,
      valor: formatCurrency(c.valorClienteReais),
      variant: "warning",
      hint: comissaoBloqueada(c)
        ? "Comissão só sobre o lucro que sobra após compensar haver ou negativo"
        : undefined,
    },
    {
      label: "Valor operação",
      valor: formatCurrency(c.valorOperacaoReais),
    }
  );

  if (
    c.descontoRecebimentoReais > 0.009 ||
    c.valorOperacaoReais - c.valorOperacaoEfetivoReais > 0.009
  ) {
    const descontoOperacao = Math.max(0, c.valorOperacaoReais - c.valorOperacaoEfetivoReais);
    linhas.push({
      label: "Desconto na operação",
      valor: `− ${formatCurrency(descontoOperacao)}`,
      variant: "discount",
      hint: "Abate depois da comissão",
    });
    linhas.push({
      label: "Operação líquida",
      valor: formatCurrency(c.valorOperacaoEfetivoReais),
      variant: "highlight",
    });
  }

  if (c.descontoManualReais > 0.009 && c.debitoTotalReais <= 0.009) {
    linhas.push({
      label: "Desconto no lucro",
      valor: `− ${formatCurrency(c.descontoManualReais)}`,
      variant: "discount",
      hint: "Abate antes da comissão",
    });
  }

  const temNegativoRecuperado =
    c.debitoTotalReais > 0.009 && c.recuperacaoNegativoReais > 0.009;

  if (temNegativoRecuperado) {
    linhas.push({
      label: "Seu adiantamento (negativo)",
      valor: "",
      secao: true,
      dividerBefore: true,
    });
    linhas.push({
      label: "Saldo antes da visita",
      valor: formatCurrency(c.debitoTotalReais),
      variant: "muted",
    });
    linhas.push({
      label: "Coberto pelo lucro",
      valor: formatCurrency(c.recuperacaoNegativoReais),
      variant: "highlight",
      hint: "Abate antes da comissão — ainda precisa receber em dinheiro",
    });
    if (c.debitoAbatidoReais <= 0.009) {
      linhas.push({
        label: "A receber (negativo)",
        valor: formatCurrency(c.recuperacaoNegativoReais),
        variant: "warning",
      });
    }
  } else if (c.debitoTotalReais > 0.009) {
    linhas.push({
      label: "Negativo em aberto",
      valor: formatCurrency(c.debitoTotalReais),
      variant: "warning",
      dividerBefore: true,
      hint: "Valor que você adiantou — recuperar na coleta",
    });
  }

  if (c.haverTotalReais > 0.009) {
    linhas.push({
      label: "Haver do ponto",
      valor: formatCurrency(c.haverTotalReais),
      variant: "highlight",
      hint: "Ponto pagou ganhadores antes",
      dividerBefore: !temNegativoRecuperado && c.debitoTotalReais <= 0.009,
    });
  }

  if (c.haverCompensadoReais > 0.009 && !temNegativoRecuperado) {
    linhas.push({
      label: "Compensado pelo lucro",
      valor: formatCurrency(c.haverCompensadoReais),
      variant: "muted",
      hint: "Abate antes da comissão",
      dividerBefore: c.haverTotalReais <= 0.009,
    });
  }

  const valorOperacaoCobranca =
    c.valorOperacaoEfetivoReais > 0.009 ? c.valorOperacaoEfetivoReais : c.valorOperacaoReais;
  const itensCobranca: ResumoFinanceiroLinha[] = [];

  if (c.debitoTotalReais > 0.009) {
    if (temNegativoRecuperado) {
      itensCobranca.push({
        label: "Devolução do adiantamento",
        valor: formatCurrency(c.recuperacaoNegativoReais),
      });
    } else {
      itensCobranca.push({
        label: "Negativo anterior",
        valor: formatCurrency(c.debitoTotalReais),
        variant: "warning",
        hint: "Adiantamento em visita negativa — recuperar nesta coleta",
      });
    }
  }
  if (valorOperacaoCobranca > 0.009) {
    itensCobranca.push({
      label: "Sua operação",
      valor: formatCurrency(valorOperacaoCobranca),
    });
  }
  if (c.pendenciaOperacaoIncluidaReais > 0.009) {
    itensCobranca.push({
      label: "Pendência anterior",
      valor: formatCurrency(c.pendenciaOperacaoIncluidaReais),
      variant: "warning",
      hint: "Incluída nesta cobrança",
    });
  }

  const totalResumo = resumoTotalVisita(c);

  if (itensCobranca.length > 0 || totalResumo.valorReais > 0.009) {
    linhas.push({
      label: "Cobrança desta visita",
      valor: "",
      secao: true,
      dividerBefore: true,
    });
    for (const item of itensCobranca) {
      linhas.push(item);
    }
    const negativoProxima = negativoFicaProximaColetaReais(c);
    if (negativoProxima > 0.009) {
      linhas.push({
        label: "Negativo que fica para a próxima coleta",
        valor: formatCurrency(negativoProxima),
        variant: "muted",
        hint: "Lucro desta visita não cobriu todo o adiantamento anterior",
      });
    }
    if (totalResumo.valorReais > 0.009) {
      linhas.push({
        label: totalResumo.label,
        valor: formatCurrency(totalResumo.valorReais),
        variant: totalResumo.tipo === "pagar" ? "warning" : "highlight",
        destaque: true,
        hint: totalResumo.hint,
      });
    }
  }

  if (c.haverQuitadoReais > 0.009) {
    linhas.push({
      label: "Você pagou o ponto (haver)",
      valor: formatCurrency(c.haverQuitadoReais),
      variant: "highlight",
      dividerBefore: true,
    });
  }

  if (c.descontoManualReais > 0.009 && c.debitoTotalReais > 0.009) {
    linhas.push({
      label: "Total deixado no ponto",
      valor: formatCurrency(c.descontoManualReais),
      variant: "discount",
      dividerBefore: true,
    });
  }

  if (c.valorPagoReais > 0.009) {
    const operacaoPaga = Math.max(0, c.valorPagoReais - c.debitoAbatidoReais);
    const partesPagamento: string[] = [];
    if (c.debitoAbatidoReais > 0.009) {
      partesPagamento.push(`negativo quitado ${formatCurrency(c.debitoAbatidoReais)}`);
    }
    if (operacaoPaga > 0.009) {
      partesPagamento.push(`operação ${formatCurrency(operacaoPaga)}`);
    }
    if (c.restanteOperacaoReais > 0.009 && operacaoPaga <= 0.009) {
      partesPagamento.push(`falta operação ${formatCurrency(c.restanteOperacaoReais)}`);
    }
    if (c.debitoRestanteReais > 0.009) {
      partesPagamento.push(`falta negativo ${formatCurrency(c.debitoRestanteReais)}`);
    }

    linhas.push({
      label: "Pagamento",
      valor: "",
      secao: true,
      dividerBefore: true,
    });
    linhas.push({
      label: "Recebido hoje",
      valor: formatCurrency(c.valorPagoReais),
      variant: "highlight",
      hint: partesPagamento.length > 0 ? partesPagamento.join(" · ") : undefined,
    });
  }

  if (c.restanteReais > 0.009) {
    linhas.push({
      label: "Situação",
      valor: "",
      secao: true,
      dividerBefore: true,
    });

    const soOperacaoPendente =
      c.restanteOperacaoReais > 0.009 &&
      Math.abs(c.restanteReais - c.restanteOperacaoReais) <= 0.02 &&
      c.debitoRestanteReais <= 0.009;

    if (soOperacaoPendente) {
      linhas.push({
        label: "Falta receber (operação)",
        valor: formatCurrency(c.restanteOperacaoReais),
        variant: "warning",
        destaque: true,
        hint: "Pagamento pendente — comissão já calculada",
      });
    } else {
      if (c.debitoRestanteReais > 0.009) {
        linhas.push({
          label: "Negativo pendente",
          valor: formatCurrency(c.debitoRestanteReais),
          variant: "warning",
        });
      }
      if (c.restanteOperacaoReais > 0.009) {
        linhas.push({
          label: "Operação pendente",
          valor: formatCurrency(c.restanteOperacaoReais),
          variant: "warning",
        });
      }
      linhas.push({
        label: "Total em aberto",
        valor: formatCurrency(c.restanteReais),
        variant: "warning",
        destaque: true,
      });
    }
  }

  if (c.haverReais > 0.009) {
    linhas.push({
      label: "Haver gerado",
      valor: formatCurrency(c.haverReais),
      variant: "highlight",
      hint: "Crédito do cliente (pagou a mais na operação)",
      dividerBefore: true,
    });
  }

  return linhas;
}

/** Linhas do resumo financeiro (prévia, relatório PNG e detalhe da visita). */
export function buildResumoFinanceiroLinhas(
  c: CalculoVisitaResult,
  comissaoPercentual: number,
  adiantamento?: AdiantamentoDetalhe,
  options?: BuildResumoFinanceiroOptions
): ResumoFinanceiroLinha[] {
  const clientFacing = options?.clientFacing === true;

  if (c.saldoNegativo) {
    const d = displayOperacaoNegativa(c);

    if (clientFacing) {
      const linhas: ResumoFinanceiroLinha[] = [];

      if (c.pendenciaOperacaoTotalReais > 0.009) {
        linhas.push({
          label:
            c.pendenciaOperacaoAbatidaReais > 0.009
              ? "Dívida anterior considerada"
              : "Dívida anterior em aberto",
          valor: formatCurrency(c.pendenciaOperacaoTotalReais),
          variant: c.pendenciaOperacaoAbatidaReais > 0.009 ? "muted" : "warning",
          hint:
            c.pendenciaOperacaoAbatidaReais > 0.009
              ? "Entrou no acerto desta visita"
              : "Ainda não abatida nesta visita",
        });
      }

      if (c.pendenciaOperacaoAbatidaReais > 0.009) {
        linhas.push({
          label: "Abatimento da dívida anterior",
          valor: formatCurrency(c.pendenciaOperacaoAbatidaReais),
          variant: "highlight",
        });
      }

      linhas.push({
        label: "Perda no visor desta visita",
        valor: formatCurrency(d.prejuizoVisitaReais),
        variant: "warning",
        destaque: true,
      });

      linhas.push({
        label: "Acerto desta visita",
        valor: "",
        secao: true,
        dividerBefore: true,
      });

      const labelsCliente: Record<string, string> = {
        "Pendência anterior (coleta passada)": "Pendência de coleta anterior",
        "Pendência desta visita": "Pendência desta visita",
        "Você repôs no ponto": "Valor reposto hoje",
        "Ponto pagou os ganhadores": "Ponto pagou na máquina",
        "Crédito anterior usado": "Crédito anterior usado",
      };

      for (const item of d.fechamento) {
        linhas.push({
          label: labelsCliente[item.label] ?? item.label,
          valor: formatCurrency(item.valorReais),
          variant:
            item.tipo === "operador"
              ? "warning"
              : item.tipo === "ponto"
                ? "highlight"
                : "highlight",
        });
      }

      if (c.novoDebitoReais > 0.009) {
        linhas.push({
          label: "Negativo a recuperar",
          valor: formatCurrency(c.novoDebitoReais),
          variant: "warning",
          destaque: true,
          dividerBefore: true,
          hint: "Recupera inteiro nas próximas coletas positivas",
        });
      }

      if (d.mostrarSaldoLiquido) {
        linhas.push({
          label: c.saldoLiquidoReais > 0 ? "Ponto ainda te deve" : "Você ainda deve ao ponto",
          valor: formatCurrency(d.valorSaldoLiquidoAbs),
          variant: c.saldoLiquidoReais > 0 ? "highlight" : "warning",
          dividerBefore: true,
        });
      }

      return linhas;
    }

    const linhas: ResumoFinanceiroLinha[] = [];

    if (c.pendenciaOperacaoTotalReais > 0.009) {
      linhas.push({
        label: "Dívida operação (em aberto)",
        valor: formatCurrency(c.pendenciaOperacaoTotalReais),
        variant: "warning",
      });
    }
    if (c.pendenciaOperacaoAbatidaReais > 0.009) {
      linhas.push({
        label: "Abatido da dívida anterior",
        valor: formatCurrency(c.pendenciaOperacaoAbatidaReais),
        variant: "highlight",
      });
    }

    linhas.push({
      label: "Perda no visor desta visita",
      valor: formatCurrency(d.prejuizoVisitaReais),
      variant: "warning",
      destaque: true,
    });

    linhas.push({
      label: "Como fechou",
      valor: "",
      secao: true,
      dividerBefore: linhas.length > 0,
    });

    for (const item of d.fechamento) {
      const adiantHint =
        item.tipo === "operador" && adiantamento ? hintAdiantamento(adiantamento) : undefined;
      linhas.push({
        label: item.label,
        valor: formatCurrency(item.valorReais),
        variant:
          item.tipo === "operador"
            ? "warning"
            : item.tipo === "ponto"
              ? "highlight"
              : "highlight",
        hint:
          adiantHint ??
          (item.tipo === "operador"
            ? "Recupera nas próximas coletas positivas"
            : item.tipo === "ponto"
              ? "Haver — abate do lucro futuro"
              : undefined),
      });
    }

    if (d.mostrarNegativoAcumulado) {
      linhas.push({
        label: "Negativo a recuperar",
        valor: "",
        secao: true,
        dividerBefore: true,
      });
      if (d.negativoAnteriorReais > 0.009) {
        linhas.push({
          label: "Saldo anterior",
          valor: formatCurrency(d.negativoAnteriorReais),
          variant: "muted",
        });
      }
      if (d.negativoAdiantadoHojeReais > 0.009) {
        linhas.push({
          label: "+ Adiantado hoje",
          valor: formatCurrency(d.negativoAdiantadoHojeReais),
          variant: "warning",
        });
      }
      linhas.push({
        label: "Total acumulado",
        valor: formatCurrency(d.negativoTotalProximaReais),
        variant: "warning",
        destaque: true,
        hint: "Soma do negativo anterior + o adiantado hoje",
      });
    }

    if (d.mostrarSaldoLiquido) {
      linhas.push({
        label: d.rotuloSaldoLiquido,
        valor: formatCurrency(d.valorSaldoLiquidoAbs),
        variant: c.saldoLiquidoReais > 0 ? "highlight" : "warning",
        dividerBefore: true,
      });
    }

    return linhas;
  }

  return buildResumoFinanceiroPositivo(c, comissaoPercentual);
}

export function buildRelatorioMensagemWhatsApp(data: RelatorioColetaData): string {
  const { calculo: c, pontoNome, empresaNome, previa, comissaoPercentual } = data;
  const dataStr = formatDateTime(data.data);

  const linhas = [
    previa ? "⏳ *PRÉVIA — AGUARDANDO PAGAMENTO*" : "✅ *Relatório de Coleta*",
    `🏢 ${empresaNome}`,
    `📍 ${pontoNome}`,
    `📅 ${dataStr}`,
    "",
    "*Máquinas:*",
    ...data.maquinas.map((m) => {
      const lucro = centesimosToReais(m.lucroCentavos);
      return `• ${m.nome}: lucro ${formatCurrency(lucro)}`;
    }),
    "",
  ];

  if (c.saldoNegativo) {
    linhas.push("*Operação negativa*");
    linhas.push("");
    const resumo = buildResumoFinanceiroLinhas(c, comissaoPercentual, data.adiantamento, {
      clientFacing: true,
    });
    for (const item of resumo) {
      if (item.secao) {
        linhas.push(`*${item.label}*`);
        continue;
      }
      const hint = item.hint ? ` _(${item.hint})_` : "";
      const prefix = item.destaque ? "*" : "";
      const suffix = item.destaque ? "*" : "";
      linhas.push(`${item.label}: ${prefix}${item.valor}${suffix}${hint}`);
    }
  } else {
    const resumo = buildResumoFinanceiroLinhas(c, comissaoPercentual);
    for (const item of resumo) {
      const hint = item.hint ? ` _(${item.hint})_` : "";
      if (item.variant === "highlight") {
        linhas.push(`💵 *${item.label}: ${item.valor}*${hint}`);
      } else if (item.variant === "discount") {
        linhas.push(`🏷️ ${item.label}: ${item.valor}${hint}`);
      } else if (item.label.startsWith("Lucro da visita")) {
        linhas.push(`💰 ${item.label}: *${item.valor}*`);
      } else if (item.label.startsWith("Comissão")) {
        linhas.push(`🤝 ${item.label}: ${item.valor}`);
      } else if (item.label === "Valor operação") {
        linhas.push(`✨ ${item.label}: ${item.valor}`);
      } else if (item.label === "Haver gerado") {
        linhas.push(`💳 *${item.label}: ${item.valor}*${hint}`);
      } else {
        linhas.push(`${item.label}: ${item.valor}${hint}`);
      }
    }
  }

  linhas.push("", "_OperaRoute_");
  return linhas.join("\n");
}

export function whatsAppUrl(telefone: string | null | undefined, mensagem: string): string {
  const msg = encodeURIComponent(mensagem);
  if (telefone) {
    const digits = telefone.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${num}?text=${msg}`;
  }
  return `https://wa.me/?text=${msg}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
