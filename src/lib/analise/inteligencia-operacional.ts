import type { SupabaseClient } from "@supabase/supabase-js";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import { NICHO_MODULO_FURA_FURA, saldoPendenteColeta, somarHaverFuraFuraAberto } from "@/lib/nichos/fura-fura";
import { NICHO_MODULO_URSINHO } from "@/lib/nichos/ursinho";
import { NICHO_MODULO_DIVERSAO } from "@/lib/nichos/diversao";
import { NICHO_MODULO_BOLINHA } from "@/lib/nichos/bolinha";
import { NICHO_MODULO_CONSIGNADO } from "@/lib/nichos/consignado";
import { DIVERSAO_EQUIPAMENTO_TIPOS } from "@/lib/equipamentos";
import {
  rankingKitsPorFuros,
  alertasBrindeAnormal,
  type RankingKitFuros,
  type PontoKitAlertaBrinde,
} from "@/lib/nichos/fura-fura/kits";
import { parseBrindesSalvos } from "@/lib/nichos/fura-fura/reconstruct-coleta";
import {
  aplicarClassificacaoSaudePorLucro,
  coletasToEventosPonto,
  visitasToEventosPonto,
  type PontoSaudeItem,
  type SaudePontoClasse,
} from "@/lib/dashboard-saude-pontos";
import type { PeriodoAnaliseRange } from "@/lib/analise/periodo-analise";
import { periodoAnterior, resolverPeriodoAnalise } from "@/lib/analise/periodo-analise";
import {
  filtrarPendenciasJaQuitadas,
  somarPendenciasPorNicho,
  type PendenciaAbertaRow,
} from "@/lib/dashboard-pendencias-abertas";
import { liquidoRecebidoCassinoVisita } from "@/lib/nichos/cassino/lucro-recebido";
import { cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";
import { formatCurrency } from "@/lib/utils";

function mapaPendenciaOperacaoAberta(
  rows: { visita_id?: string | null; tipo?: string | null; valor?: number | null }[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of rows) {
    const t = (p.tipo ?? "").toLowerCase();
    if (!p.visita_id || (t !== "pagamento_pendente" && t !== "parcial")) continue;
    map.set(p.visita_id, (map.get(p.visita_id) ?? 0) + Number(p.valor ?? 0));
  }
  return map;
}

function finalizarSaudeMap(saudeMap: Map<string, PontoSaudeItem>): PontoSaudeItem[] {
  return aplicarClassificacaoSaudePorLucro([...saudeMap.values()]);
}

function enriquecerSaudeMap(saudeMap: Map<string, PontoSaudeItem>) {
  for (const item of finalizarSaudeMap(saudeMap)) {
    saudeMap.set(item.pontoId, item);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function consolidarRankingPontos(listas: RankingPonto[]): RankingPonto[] {
  const map = new Map<string, RankingPonto>();
  for (const r of listas) {
    const prev = map.get(r.pontoId) ?? {
      pontoId: r.pontoId,
      nome: r.nome,
      cidade: r.cidade,
      lucro: 0,
      bruto: 0,
      dinheiroOperacao: 0,
      custoBrindes: 0,
      movimentos: 0,
      comissao: 0,
      entrada: 0,
      saida: 0,
      margemPct: null,
      lucroPorMovimento: null,
      nicho: "consolidado" as const,
    };
    prev.lucro += r.lucro;
    prev.bruto += r.bruto;
    prev.dinheiroOperacao += r.dinheiroOperacao;
    prev.custoBrindes += r.custoBrindes;
    prev.movimentos += r.movimentos;
    prev.comissao = (prev.comissao ?? 0) + (r.comissao ?? Math.max(0, r.bruto - r.dinheiroOperacao));
    prev.entrada = (prev.entrada ?? 0) + (r.entrada ?? r.bruto);
    prev.saida = (prev.saida ?? 0) + (r.saida ?? 0);
    if (!prev.cidade && r.cidade) prev.cidade = r.cidade;
    if (prev.nome === "Ponto" && r.nome !== "Ponto") prev.nome = r.nome;
    map.set(r.pontoId, prev);
  }
  return [...map.values()]
    .map((r) => enrichRankingPonto(r))
    .sort((a, b) => b.lucro - a.lucro);
}

function enrichRankingPonto(r: RankingPonto): RankingPonto {
  const bruto = round2(r.bruto);
  const dinheiroOperacao = round2(r.dinheiroOperacao);
  const lucro = round2(r.lucro);
  const comissao = round2(
    r.comissao ?? Math.max(0, bruto - (dinheiroOperacao > 0 ? dinheiroOperacao : lucro))
  );
  const entrada = round2(r.entrada ?? bruto);
  const saida = round2(r.saida ?? 0);
  const baseMargem = entrada > 0.009 ? entrada : bruto > 0.009 ? bruto : dinheiroOperacao;
  return {
    ...r,
    lucro,
    bruto,
    dinheiroOperacao,
    custoBrindes: round2(r.custoBrindes),
    comissao,
    entrada,
    saida,
    margemPct: baseMargem > 0.009 ? round2((lucro / baseMargem) * 100) : null,
    lucroPorMovimento: r.movimentos > 0 ? round2(lucro / r.movimentos) : null,
  };
}

/** Unifica "Reginópolis" / "Reginopolis" / espaços extras numa só chave. */
function chaveCidadeNormalizada(raw: string | null | undefined): { key: string; display: string } {
  const trimmed = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { key: "sem-cidade", display: "Sem cidade" };
  const key = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return { key, display: trimmed };
}

function agregarRankingCidades(pontos: RankingPonto[], lucroTotal: number): RankingCidade[] {
  const map = new Map<string, RankingCidade>();
  for (const p of pontos) {
    const { key, display } = chaveCidadeNormalizada(p.cidade);
    const prev = map.get(key) ?? {
      cidade: display,
      lucro: 0,
      bruto: 0,
      dinheiroOperacao: 0,
      custoBrindes: 0,
      movimentos: 0,
      pontos: 0,
      shareLucroPct: null,
      margemPct: null,
    };
    // Prefere grafia com acento / mais completa como rótulo.
    if (
      display !== "Sem cidade" &&
      (prev.cidade === "Sem cidade" ||
        (display.length >= prev.cidade.length && /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/u.test(display)))
    ) {
      prev.cidade = display;
    }
    prev.lucro += p.lucro;
    prev.bruto += p.bruto;
    prev.dinheiroOperacao += p.dinheiroOperacao;
    prev.custoBrindes += p.custoBrindes;
    prev.movimentos += p.movimentos;
    prev.pontos += 1;
    map.set(key, prev);
  }

  return [...map.values()]
    .map((c) => {
      const lucro = round2(c.lucro);
      const bruto = round2(c.bruto);
      const dinheiroOperacao = round2(c.dinheiroOperacao);
      const custoBrindes = round2(c.custoBrindes);
      const baseMargem = dinheiroOperacao > 0 ? dinheiroOperacao : bruto;
      return {
        ...c,
        lucro,
        bruto,
        dinheiroOperacao,
        custoBrindes,
        shareLucroPct:
          Math.abs(lucroTotal) > 0.009
            ? round2((lucro / lucroTotal) * 100)
            : null,
        margemPct: baseMargem > 0 ? round2((lucro / baseMargem) * 100) : null,
      };
    })
    .sort((a, b) => b.lucro - a.lucro);
}

type ColetaNichoRow = {
  id: string;
  ponto_id: string | null;
  equipamento_id?: string | null;
  created_at: string;
  valor_bruto?: number | null;
  valor_a_receber?: number | null;
  valor_pago_recebido?: number | null;
  lucro_real?: number | null;
  custo_brindes?: number | null;
  entrada_periodo?: number | null;
  brindes_entregues?: unknown;
  pontos?: { nome?: string } | { nome?: string }[] | null;
  equipamentos?:
    | {
        id: string;
        nome: string;
        numero_maquina: string | null;
        tipo: string | null;
        ponto_id: string | null;
        pontos?: { nome?: string } | { nome?: string }[] | null;
      }
    | {
        id: string;
        nome: string;
        numero_maquina: string | null;
        tipo: string | null;
        ponto_id: string | null;
        pontos?: { nome?: string } | { nome?: string }[] | null;
      }[]
    | null;
};

function agregarNichoColetaAnalise(
  coletas: ColetaNichoRow[],
  opts: {
    nicho: Extract<RankingPonto["nicho"], "diversao" | "bolinha" | "consignado">;
    totalMaquinas: number;
    comBrindes: boolean;
    tipoFallback: RankingMaquina["tipo"];
  }
): NichoColetaAnalise {
  const mapPonto = new Map<string, RankingPonto>();
  const mapBrinde = new Map<string, RankingBrinde>();
  const mapMaquina = new Map<string, RankingMaquina>();

  let brutoMaquina = 0;
  let dinheiroOperacao = 0;
  let lucroLivre = 0;
  let lucroRecebido = 0;
  let custoBrindes = 0;
  let recebido = 0;
  let pendente = 0;

  for (const c of coletas) {
    const ponto = Array.isArray(c.pontos) ? c.pontos[0] : c.pontos;
    const eq = Array.isArray(c.equipamentos) ? c.equipamentos[0] : c.equipamentos;
    const bruto = Number(c.valor_bruto) || 0;
    const dinheiroOp = Number(c.valor_a_receber) || 0;
    const lucro = Number(c.lucro_real) || 0;
    const custo = Number(c.custo_brindes) || 0;
    const entrada =
      c.entrada_periodo != null ? Number(c.entrada_periodo) : Math.round(bruto * 100);

    brutoMaquina += bruto;
    dinheiroOperacao += dinheiroOp;
    lucroLivre += lucro;
    custoBrindes += custo;
    const pago = Number(c.valor_pago_recebido) || 0;
    recebido += pago;
    pendente += saldoPendenteColeta(c);
    // Análise (regra caixa): lucro só na proporção já paga.
    const fracPago =
      dinheiroOp > 0.009 ? Math.min(1, pago / dinheiroOp) : pago > 0.009 ? 1 : 0;
    const lucroRecebidoColeta = round2(lucro * fracPago);
    lucroRecebido += lucroRecebidoColeta;

    if (c.ponto_id) {
      const prev = mapPonto.get(c.ponto_id) ?? {
        pontoId: c.ponto_id,
        nome: ponto?.nome ?? "Ponto",
        cidade: null,
        lucro: 0,
        bruto: 0,
        dinheiroOperacao: 0,
        custoBrindes: 0,
        movimentos: 0,
        comissao: 0,
        entrada: 0,
        saida: 0,
        nicho: opts.nicho,
      };
      prev.lucro += lucroRecebidoColeta;
      prev.bruto += bruto;
      prev.dinheiroOperacao += dinheiroOp;
      prev.custoBrindes += custo;
      prev.comissao = (prev.comissao ?? 0) + Math.max(0, bruto - dinheiroOp);
      prev.entrada =
        (prev.entrada ?? 0) +
        (c.entrada_periodo != null ? centesimosToReais(Number(c.entrada_periodo)) : bruto);
      prev.movimentos++;
      mapPonto.set(c.ponto_id, prev);
    }

    if (eq?.id) {
      const eqPonto = Array.isArray(eq.pontos) ? eq.pontos[0] : eq.pontos;
      const prevM = mapMaquina.get(eq.id) ?? {
        equipamentoId: eq.id,
        nome: eq.nome,
        numeroMaquina: eq.numero_maquina,
        tipo: (eq.tipo as RankingMaquina["tipo"]) ?? opts.tipoFallback,
        pontoId: eq.ponto_id ?? c.ponto_id ?? "",
        pontoNome: eqPonto?.nome ?? ponto?.nome ?? "Ponto",
        lucro: 0,
        entrada: 0,
        saida: 0,
        pctPago: null,
        leituras: 0,
      };
      prevM.lucro += lucroRecebidoColeta;
      prevM.entrada += entrada;
      prevM.leituras++;
      mapMaquina.set(eq.id, prevM);
    }

    if (opts.comBrindes) {
      for (const b of parseBrindesSalvos(c.brindes_entregues)) {
        const key = b.nome.trim().toLowerCase();
        const bp = mapBrinde.get(key) ?? {
          nome: b.nome,
          itemId: b.item_id,
          entregues: 0,
          custoTotal: 0,
          coletasComEntrega: 0,
          estoquePontos: 0,
          valorEstoquePontos: 0,
          lucroAssociado: 0,
        };
        bp.entregues += b.quantidade;
        bp.custoTotal += b.quantidade * b.custo_unitario;
        bp.coletasComEntrega++;
        bp.lucroAssociado += lucroRecebidoColeta;
        mapBrinde.set(key, bp);
      }
    }
  }

  const rankingPontos = [...mapPonto.values()]
    .map((r) => ({
      ...r,
      lucro: round2(r.lucro),
      bruto: round2(r.bruto),
      dinheiroOperacao: round2(r.dinheiroOperacao),
      custoBrindes: round2(r.custoBrindes),
    }))
    .sort((a, b) => b.lucro - a.lucro);

  const eventos = coletasToEventosPonto(
    coletas
      .filter((c): c is typeof c & { ponto_id: string } => Boolean(c.ponto_id))
      .map((c) => {
        const raw = c.pontos;
        const pontosNorm = Array.isArray(raw)
          ? raw.map((p) => ({ nome: p?.nome ?? "Ponto" }))
          : raw
            ? { nome: raw.nome ?? "Ponto" }
            : null;
        return {
          id: c.id,
          ponto_id: c.ponto_id,
          visita_id: null as string | null,
          created_at: c.created_at,
          lucro_centavos: null as number | null,
          lucro_real: c.lucro_real ?? null,
          valor_liquido: null as number | null,
          valor_bruto: c.valor_bruto ?? null,
          entrada: null as number | null,
          pontos: pontosNorm,
        };
      })
  );

  const saudeMap = new Map<string, PontoSaudeItem>();
  for (const e of eventos) {
    const prev = saudeMap.get(e.ponto_id) ?? {
      pontoId: e.ponto_id,
      nome: e.ponto_nome,
      classe: "sem_dados" as SaudePontoClasse,
      indice: null,
      lucroMes: 0,
      impulsos: 0,
      pressoes: 0,
      visitas: 0,
    };
    prev.visitas++;
    prev.lucroMes += e.lucroReais;
    if (e.negativa || e.lucroReais < -0.009) prev.pressoes++;
    else if (e.lucroReais > 0.009) prev.impulsos++;
    saudeMap.set(e.ponto_id, prev);
  }
  enriquecerSaudeMap(saudeMap);

  return {
    caixa: {
      brutoMaquina: round2(brutoMaquina),
      dinheiroOperacao: round2(dinheiroOperacao),
      reservaBrindes: round2(custoBrindes),
      lucroLivre: round2(lucroLivre),
      /** Lucro já realizado em caixa (proporção paga) — usado no líquido da Análise */
      lucroRecebido: round2(lucroRecebido),
      recebido: round2(recebido),
      pendenteReceber: round2(pendente),
    },
    coletas: coletas.length,
    totalMaquinas: opts.totalMaquinas,
    rankingPontos,
    rankingMaquinas: [...mapMaquina.values()]
      .map((m) => ({ ...m, lucro: round2(m.lucro) }))
      .sort((a, b) => b.lucro - a.lucro),
    rankingBrindes: [...mapBrinde.values()]
      .map((b) => ({ ...b, custoTotal: round2(b.custoTotal) }))
      .sort((a, b) => b.entregues - a.entregues),
    saudePontos: [...saudeMap.values()].sort((a, b) => b.lucroMes - a.lucroMes),
  };
}

export type FuraFuraCaixaMes = {
  /** furos × preço — antes da comissão do bar */
  brutoMaquina: number;
  /** Soma valor_a_receber — dinheiro da operação antes de reservar brindes */
  dinheiroOperacao: number;
  /** Custo real dos brindes entregues — separar para repor */
  reservaBrindes: number;
  /** lucro_real — o que é seu depois da reserva (accrual) */
  lucroLivre: number;
  /** Lucro na proporção já paga — líquido da Análise (regra caixa) */
  lucroRecebido: number;
  recebido: number;
  pendenteReceber: number;
  /** Crédito do ponto (pagou a mais) — usar em próximas coletas */
  haver: number;
};

export type RankingPonto = {
  pontoId: string;
  nome: string;
  /** Cidade cadastrada no ponto — null se não informada */
  cidade: string | null;
  /** Lucro líquido da operação (o que você ficou / recebeu). */
  lucro: number;
  bruto: number;
  dinheiroOperacao: number;
  custoBrindes: number;
  movimentos: number;
  /** Comissão do cliente/bar no período. */
  comissao?: number;
  /** Entrada das máquinas (quando disponível). */
  entrada?: number;
  /** Saída das máquinas (quando disponível). */
  saida?: number;
  margemPct?: number | null;
  lucroPorMovimento?: number | null;
  nicho: "fura_fura" | "cassino" | "ursinho" | "diversao" | "bolinha" | "consignado" | "consolidado";
};

/** Faturamento agregado por cidade (pontos consolidados no período). */
export type RankingCidade = {
  cidade: string;
  lucro: number;
  bruto: number;
  dinheiroOperacao: number;
  custoBrindes: number;
  movimentos: number;
  /** Quantidade de pontos com movimento no período */
  pontos: number;
  /** Participação no lucro líquido consolidado (0–100) */
  shareLucroPct: number | null;
  margemPct: number | null;
};

export type RankingBrinde = {
  nome: string;
  itemId?: string;
  entregues: number;
  custoTotal: number;
  coletasComEntrega: number;
  estoquePontos: number;
  valorEstoquePontos: number;
  lucroAssociado: number;
};

export type RankingMaquina = {
  equipamentoId: string;
  nome: string;
  numeroMaquina: string | null;
  tipo:
    | "cassino"
    | "ursinho"
    | "vending_ursinho"
    | "fura_fura"
    | "diversao"
    | "sinuca"
    | "fliperama"
    | "cadeira_massagem"
    | "bolinha"
    | "consignado"
    | null;
  pontoId: string;
  pontoNome: string;
  lucro: number;
  entrada: number;
  saida: number;
  pctPago: number | null;
  leituras: number;
};

export type RankingJogo = {
  nome: string;
  lucro: number;
  entrada: number;
  saida: number;
  pctPago: number | null;
  maquinas: number;
  leituras: number;
};

export type InsightOperacional = {
  id: string;
  severidade: "info" | "success" | "warning" | "danger";
  titulo: string;
  descricao: string;
  href?: string;
  hrefLabel?: string;
};

export type EstoqueResumoItem = {
  id: string;
  nome: string;
  quantidade: number;
  quantidadeMinima: number;
  custoUnitario: number;
  valorTotal: number;
  abaixoMinimo: boolean;
};

/** Ponto com estoque alocado em alerta (zerado / item zerado / muito baixo). */
export type AlertaEstoquePontoCliente = {
  pontoId: string;
  pontoNome: string;
  totalUnidades: number;
  /** Ex.: "0 brindes" ou "faca 0 · bichão 3" */
  resumo: string;
  itens: { nome: string; quantidade: number }[];
  severidade: "danger" | "warning";
  motivos: string[];
};

export type PontoAtencao = {
  pontoId: string;
  nome: string;
  motivos: string[];
  lucroMes: number;
  classe: SaudePontoClasse;
  score: number;
};

export type InteligenciaOperacional = {
  periodoLabel: string;
  periodoPreset: PeriodoAnaliseRange["preset"];
  nichos: {
    cassino: boolean;
    furaFura: boolean;
    ursinho: boolean;
    diversao: boolean;
    bolinha: boolean;
    consignado: boolean;
  };
  visaoGeral: {
    faturamentoBruto: number;
    /** @deprecated use liquidoOperacao */
    lucroLiquido: number;
    /** Entrada total das máquinas no período. */
    entrada: number;
    /** Saída total das máquinas no período. */
    saida: number;
    /** Comissão do cliente/bar. */
    comissao: number;
    /** Resultado do movimento (entrada − saída). */
    liquidoMovimento: number;
    /** O que você recebeu / ficou na operação. */
    liquidoOperacao: number;
    custoBrindesMes: number;
    margemPct: number | null;
    valorEstoqueCentral: number;
    unidadesEstoqueCentral: number;
    valorBrindesPontos: number;
    unidadesBrindesPontos: number;
    totalMaquinasCassino: number;
    totalMaquinasUrsinho: number;
    totalMaquinasDiversao: number;
    totalMaquinasBolinha: number;
    totalMaquinasConsignado: number;
    totalPontosFura: number;
    totalFurosMes: number;
    aReceber: number;
    haver: number;
    movimentos: number;
  };
  /** Comparativo com a janela anterior de mesmo comprimento. */
  comparativo: {
    labelAnterior: string;
    liquidoOperacaoAnterior: number;
    liquidoOperacaoDelta: number;
    liquidoOperacaoDeltaPct: number | null;
    entradaAnterior: number;
    entradaDelta: number;
    movimentosAnterior: number;
    movimentosDelta: number;
  } | null;
  /** Saúde consolidada dos pontos (todos os nichos). */
  saudePontos: PontoSaudeItem[];
  /** Ranking consolidado (todos os nichos) — ordenado por lucro desc */
  rankingPontos: RankingPonto[];
  /** Faturamento / lucro por cidade — ordenado por lucro desc */
  rankingCidades: RankingCidade[];
  furaFura: {
    caixa: FuraFuraCaixaMes;
    totalFuros: number;
    coletas: number;
    rankingPontos: RankingPonto[];
    rankingBrindes: RankingBrinde[];
    rankingKits: RankingKitFuros[];
    alertasBrindeKit: PontoKitAlertaBrinde[];
    saudePontos: PontoSaudeItem[];
  } | null;
  cassino: {
    lucro: number;
    /** Comissão do cliente/bar nas visitas positivas do período. */
    comissao: number;
    entrada: number;
    saida: number;
    visitas: number;
    rankingPontos: RankingPonto[];
    rankingMaquinas: RankingMaquina[];
    rankingJogos: RankingJogo[];
    saudePontos: PontoSaudeItem[];
  } | null;
  ursinho: {
    caixa: FuraFuraCaixaMes;
    coletas: number;
    totalMaquinas: number;
    rankingPontos: RankingPonto[];
    rankingMaquinas: RankingMaquina[];
    rankingBrindes: RankingBrinde[];
    saudePontos: PontoSaudeItem[];
  } | null;
  /** Sinuca / fliperama / massagem / diversão genérica */
  diversao: NichoColetaAnalise | null;
  bolinha: NichoColetaAnalise | null;
  consignado: NichoColetaAnalise | null;
  estoque: {
    itens: EstoqueResumoItem[];
    valorTotal: number;
    itensAbaixoMinimo: number;
    /** Pontos com brindes/itens em alerta (resumo rápido) */
    alertasPontos: AlertaEstoquePontoCliente[];
  };
  pontosAtencao: PontoAtencao[];
  insights: InsightOperacional[];
};

/** Bloco padrão de análise para nichos baseados em coleta (diversão, bolinha, consignado). */
export type NichoColetaAnalise = {
  caixa: {
    brutoMaquina: number;
    dinheiroOperacao: number;
    reservaBrindes: number;
    lucroLivre: number;
    lucroRecebido: number;
    recebido: number;
    pendenteReceber: number;
  };
  coletas: number;
  totalMaquinas: number;
  rankingPontos: RankingPonto[];
  rankingMaquinas: RankingMaquina[];
  rankingBrindes: RankingBrinde[];
  saudePontos: PontoSaudeItem[];
};

type BrindePonto = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario?: number;
};

function pctPago(entrada: number, saida: number): number | null {
  if (entrada <= 0) return null;
  return round2((saida / entrada) * 100);
}

function gerarInsights(data: {
  rankingFura: RankingPonto[];
  rankingCassino: RankingPonto[];
  rankingUrsinho: RankingPonto[];
  rankingBrindes: RankingBrinde[];
  rankingBrindesUrsinho: RankingBrinde[];
  rankingKits: RankingKitFuros[];
  alertasBrindeKit: PontoKitAlertaBrinde[];
  rankingMaquinas: RankingMaquina[];
  rankingMaquinasUrsinho: RankingMaquina[];
  estoque: EstoqueResumoItem[];
  alertasPontos: AlertaEstoquePontoCliente[];
  pontosAtencao: PontoAtencao[];
  visao: InteligenciaOperacional["visaoGeral"];
  comparativo: InteligenciaOperacional["comparativo"];
  fura90?: {
    coletas: number;
    lucro: number;
    brindesEntregues: number;
  };
}): InsightOperacional[] {
  const insights: InsightOperacional[] = [];
  let seq = 0;
  const push = (i: Omit<InsightOperacional, "id">) => {
    insights.push({ ...i, id: `ins-${seq++}` });
  };

  if (data.comparativo) {
    const d = data.comparativo.liquidoOperacaoDelta;
    const pct = data.comparativo.liquidoOperacaoDeltaPct;
    if (Math.abs(d) > 0.009) {
      push({
        severidade: d >= 0 ? "success" : "warning",
        titulo:
          d >= 0
            ? `Lucro líquido subiu ${pct != null ? `${pct.toFixed(0)}%` : formatDelta(d)}`
            : `Lucro líquido caiu ${pct != null ? `${Math.abs(pct).toFixed(0)}%` : formatDelta(d)}`,
        descricao: `Vs período anterior (${data.comparativo.labelAnterior}): ${formatDelta(d)} · entrada ${formatDelta(data.comparativo.entradaDelta)} · movimentos ${data.comparativo.movimentosDelta >= 0 ? "+" : ""}${data.comparativo.movimentosDelta}`,
      });
    }
  }

  if (data.visao.aReceber > 0.009 && data.visao.liquidoOperacao > 0.009) {
    const ratio = data.visao.aReceber / data.visao.liquidoOperacao;
    if (ratio >= 0.5) {
      push({
        severidade: ratio >= 1 ? "danger" : "warning",
        titulo: "A receber alto frente ao lucro",
        descricao: `Pendente ${formatCurrency(data.visao.aReceber)} · ${((ratio) * 100).toFixed(0)}% do lucro líquido do período — priorize cobrança`,
        href: "/pendencias",
        hrefLabel: "Pendências",
      });
    }
  }

  if (data.fura90 && data.fura90.coletas >= 5) {
    const ratio90 =
      data.fura90.brindesEntregues > 0 && data.fura90.lucro !== 0
        ? data.fura90.brindesEntregues / Math.max(1, data.fura90.coletas)
        : null;
    if (ratio90 != null && ratio90 > 8) {
      push({
        severidade: "info",
        titulo: "Histórico 90d: volume alto de brindes/coleta",
        descricao: `Média ~${ratio90.toFixed(1)} brindes por coleta nas últimas 90 dias — revise kits e furadores`,
        href: "/estoque/kits",
        hrefLabel: "Kits",
      });
    }
  }

  const piorFura = [...data.rankingFura].sort((a, b) => a.lucro - b.lucro)[0];
  if (piorFura && piorFura.lucro < -0.009) {
    push({
      severidade: "danger",
      titulo: `Maior prejuízo fura-fura: ${piorFura.nome}`,
      descricao: `Prejuízo de ${formatCurrency(Math.abs(piorFura.lucro))} no período · custo brindes ${formatCurrency(piorFura.custoBrindes)}`,
      href: `/pontos/${piorFura.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  const melhorFura = [...data.rankingFura].sort((a, b) => b.lucro - a.lucro)[0];
  if (melhorFura && melhorFura.lucro > 0.009) {
    push({
      severidade: "success",
      titulo: `Melhor rendimento fura-fura: ${melhorFura.nome}`,
      descricao: `Seu dinheiro ${formatCurrency(melhorFura.lucro)} (caixa ${formatCurrency(melhorFura.dinheiroOperacao)} − brindes ${formatCurrency(melhorFura.custoBrindes)})`,
      href: `/pontos/${melhorFura.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  const piorCassino = [...data.rankingCassino].sort((a, b) => a.lucro - b.lucro)[0];
  if (piorCassino && piorCassino.lucro < -0.009) {
    push({
      severidade: "danger",
      titulo: `Bar com mais pressão (cassino): ${piorCassino.nome}`,
      descricao: `Recebido ${formatCurrency(piorCassino.lucro)} no período · ${piorCassino.movimentos} visita(s)`,
      href: `/pontos/${piorCassino.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  const melhorMaquina = [...data.rankingMaquinas].sort((a, b) => b.lucro - a.lucro)[0];
  if (melhorMaquina && melhorMaquina.lucro > 0.009) {
    push({
      severidade: "success",
      titulo: `Máquina destaque (cassino): ${melhorMaquina.nome}`,
      descricao: `${melhorMaquina.pontoNome} · lucro ${formatCurrency(melhorMaquina.lucro)}${melhorMaquina.pctPago != null ? ` · paga ${melhorMaquina.pctPago.toFixed(1)}%` : ""}`,
      href: `/pontos/${melhorMaquina.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  const melhorUrso = [...data.rankingMaquinasUrsinho].sort((a, b) => b.lucro - a.lucro)[0];
  if (melhorUrso && melhorUrso.lucro > 0.009) {
    push({
      severidade: "success",
      titulo: `Máquina destaque (ursinho): ${melhorUrso.nome}`,
      descricao: `${melhorUrso.pontoNome} · lucro ${formatCurrency(melhorUrso.lucro)} · ${melhorUrso.leituras} coleta(s)`,
      href: `/pontos/${melhorUrso.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  const piorUrso = [...data.rankingUrsinho].sort((a, b) => a.lucro - b.lucro)[0];
  if (piorUrso && piorUrso.lucro < -0.009) {
    push({
      severidade: "danger",
      titulo: `Maior prejuízo ursinho: ${piorUrso.nome}`,
      descricao: `Prejuízo de ${formatCurrency(Math.abs(piorUrso.lucro))} · brindes ${formatCurrency(piorUrso.custoBrindes)}`,
      href: `/pontos/${piorUrso.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  const melhorUrsoPonto = [...data.rankingUrsinho].sort((a, b) => b.lucro - a.lucro)[0];
  if (melhorUrsoPonto && melhorUrsoPonto.lucro > 0.009) {
    push({
      severidade: "success",
      titulo: `Melhor ponto ursinho: ${melhorUrsoPonto.nome}`,
      descricao: `Lucro ${formatCurrency(melhorUrsoPonto.lucro)} · ${melhorUrsoPonto.movimentos} coleta(s)`,
      href: `/pontos/${melhorUrsoPonto.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  const melhorKit = data.rankingKits[0];
  if (melhorKit && melhorKit.totalFuros >= 10) {
    push({
      severidade: "success",
      titulo: `Kit que mais atrai furos: ${melhorKit.kitNome}`,
      descricao: `${melhorKit.totalFuros} furos no período · média ${melhorKit.mediaFurosPorColeta.toFixed(1)} por coleta`,
      href: "/estoque/kits",
      hrefLabel: "Ver kits",
    });
  }

  for (const a of data.alertasBrindeKit.slice(0, 2)) {
    push({
      severidade: "warning",
      titulo: `Brindes acima do normal: ${a.pontoNome}`,
      descricao: `${a.kitNome ?? "Kit"} — ${a.ratioAtual.toFixed(2)} brindes/furo vs média ${a.ratioMedioKit.toFixed(2)} (+${a.desvioPct.toFixed(0)}%) — verificar furador`,
      href: `/pontos/${a.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  for (const b of [...data.rankingBrindes, ...data.rankingBrindesUrsinho]) {
    if (b.estoquePontos >= 3 && b.entregues === 0) {
      push({
        severidade: "warning",
        titulo: `Brinde parado: ${b.nome}`,
        descricao: `${b.estoquePontos} un. alocadas nos pontos sem entrega no período — considere trocar ou retirar`,
        href: "/estoque",
        hrefLabel: "Estoque",
      });
    }
    if (b.entregues >= 5 && b.estoquePontos <= 2) {
      push({
        severidade: "info",
        titulo: `Alta demanda: ${b.nome}`,
        descricao: `${b.entregues} entregues no período · só ${b.estoquePontos} un. nos pontos — repor urgente`,
        href: "/estoque",
        hrefLabel: "Repor",
      });
    }
  }

  for (const e of data.estoque.filter((i) => i.abaixoMinimo)) {
    push({
      severidade: "warning",
      titulo: `Estoque baixo: ${e.nome}`,
      descricao: `${e.quantidade} un. (mín. ${e.quantidadeMinima}) · valor ${formatCurrency(e.valorTotal)}`,
      href: "/estoque",
      hrefLabel: "Abrir estoque",
    });
  }

  for (const a of data.alertasPontos.slice(0, 4)) {
    push({
      severidade: a.severidade,
      titulo: `Estoque no ponto: ${a.pontoNome}`,
      descricao: a.resumo,
      href: `/pontos/${a.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  for (const p of data.pontosAtencao.slice(0, 3)) {
    push({
      severidade: p.lucroMes < -0.009 ? "danger" : "warning",
      titulo: `Exige atenção: ${p.nome}`,
      descricao: p.motivos.join(" · "),
      href: `/pontos/${p.pontoId}`,
      hrefLabel: "Ver ponto",
    });
  }

  if (data.visao.margemPct != null && data.visao.entrada > 0) {
    push({
      severidade:
        data.visao.margemPct >= 30 ? "success" : data.visao.margemPct >= 15 ? "info" : "warning",
      titulo: `Margem da operação: ${data.visao.margemPct.toFixed(1)}%`,
      descricao: `Entrada ${formatCurrency(data.visao.entrada)} · líquido ${formatCurrency(data.visao.liquidoOperacao)} · comissão ${formatCurrency(data.visao.comissao)} · brindes ${formatCurrency(data.visao.custoBrindesMes)}`,
    });
  }

  return insights.slice(0, 14);
}

function formatDelta(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign} ${formatCurrency(Math.abs(n))}`;
}

export async function fetchInteligenciaOperacional(
  supabase: SupabaseClient,
  empresaId: string,
  opts: {
    cassino: boolean;
    furaFura: boolean;
    ursinho: boolean;
    diversao?: boolean;
    bolinha?: boolean;
    consignado?: boolean;
    periodo?: PeriodoAnaliseRange;
  }
): Promise<InteligenciaOperacional> {
  const periodo = opts.periodo ?? resolverPeriodoAnalise({ periodo: "mes" });
  const startISO = periodo.inicioISO;
  const endISO = periodo.fimISO;
  const prevPeriodo = periodoAnterior(periodo);
  const prevStartISO = prevPeriodo.inicioISO;
  const prevEndISO = prevPeriodo.fimISO;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const wantDiversao = Boolean(opts.diversao);
  const wantBolinha = Boolean(opts.bolinha);
  const wantConsignado = Boolean(opts.consignado);

  const coletaSelect =
    "id, ponto_id, equipamento_id, created_at, valor_bruto, valor_a_receber, valor_pago_recebido, lucro_real, custo_brindes, entrada_periodo, brindes_entregues, pontos(nome), equipamentos(id, nome, numero_maquina, tipo, ponto_id, pontos(nome))";
  const coletaPrevSelect =
    "lucro_real, valor_a_receber, valor_pago_recebido, valor_bruto, entrada_periodo";
  const coletaSaldoSelect = "valor_a_receber, valor_pago_recebido";

  function queryColetasSaldoAberto(nichoModulo: string) {
    return supabase
      .from("coletas")
      .select(coletaSaldoSelect)
      .eq("empresa_id", empresaId)
      .eq("nicho_modulo", nichoModulo)
      .gt("valor_a_receber", 0);
  }

  const [
    estoqueRes,
    pontosRes,
    equipRes,
    pendenciasRes,
    coletasFuraRes,
    coletasFura90Res,
    visitasRes,
    coletasCassinoRes,
    coletasUrsinhoRes,
    coletasDiversaoRes,
    coletasBolinhaRes,
    coletasConsignadoRes,
    prevVisitasRes,
    prevColetasCassinoRes,
    prevColetasFuraRes,
    prevColetasUrsinhoRes,
    prevColetasDiversaoRes,
    prevColetasBolinhaRes,
    prevColetasConsignadoRes,
    saldoAbertoFuraRes,
    saldoAbertoUrsinhoRes,
    saldoAbertoDiversaoRes,
    saldoAbertoBolinhaRes,
    saldoAbertoConsignadoRes,
  ] = await Promise.all([
    supabase
      .from("estoque")
      .select("id, nome_item, quantidade, quantidade_minima, custo_unitario")
      .eq("empresa_id", empresaId),
    supabase
      .from("pontos")
      .select(
        "id, nome, cidade, estoque_brindes, furos_estoque, furos_minimo, kit_ativo_id, status, preco_furo"
      )
      .eq("empresa_id", empresaId)
      .eq("status", "ativo"),
    supabase
      .from("equipamentos")
      .select("id, nome, numero_maquina, tipo, ponto_id, status, estoque_brindes, pontos(nome)")
      .eq("empresa_id", empresaId),
    supabase
      .from("pendencias")
      .select("id, tipo, titulo, valor, descricao, status, visita_id, coleta_id")
      .eq("empresa_id", empresaId)
      .eq("status", "aberta"),
    opts.furaFura
      ? supabase
          .from("coletas")
          .select(
            "id, ponto_id, created_at, valor_bruto, valor_a_receber, valor_pago_recebido, lucro_real, custo_brindes, quantidade_furos, brindes_entregues, kit_id, kit_nome, pontos(nome)"
          )
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.furaFura
      ? supabase
          .from("coletas")
          .select("brindes_entregues, lucro_real, created_at")
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
          .gte("created_at", ninetyDaysAgo)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.cassino
      ? supabase
          .from("visitas")
          .select(
            "id, ponto_id, created_at, total_lucro_centavos, valor_operacao, valor_operacao_efetivo, valor_pago, restante, debito_abatido, valor_cliente, total_entrada_periodo, total_saida_periodo, saldo_negativo, desconto, adiantamento_pix, adiantamento_dinheiro, pontos(nome)"
          )
          .eq("empresa_id", empresaId)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.cassino
      ? supabase
          .from("coletas")
          .select(
            "equipamento_id, entrada_periodo, saida_periodo, lucro_centavos, visita_id, equipamentos(id, nome, numero_maquina, tipo, ponto_id, pontos(nome))"
          )
          .eq("empresa_id", empresaId)
          .not("visita_id", "is", null)
          .not("equipamento_id", "is", null)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.ursinho
      ? supabase
          .from("coletas")
          .select(coletaSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_URSINHO)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantDiversao
      ? supabase
          .from("coletas")
          .select(coletaSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_DIVERSAO)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantBolinha
      ? supabase
          .from("coletas")
          .select(coletaSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantConsignado
      ? supabase
          .from("coletas")
          .select(coletaSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_CONSIGNADO)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.cassino
      ? supabase
          .from("visitas")
          .select(
            "id, total_lucro_centavos, valor_operacao, valor_operacao_efetivo, valor_pago, restante, saldo_negativo, desconto, adiantamento_pix, adiantamento_dinheiro"
          )
          .eq("empresa_id", empresaId)
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.cassino
      ? supabase
          .from("coletas")
          .select("entrada_periodo, saida_periodo")
          .eq("empresa_id", empresaId)
          .not("visita_id", "is", null)
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.furaFura
      ? supabase
          .from("coletas")
          .select(coletaPrevSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_FURA_FURA)
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.ursinho
      ? supabase
          .from("coletas")
          .select(coletaPrevSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_URSINHO)
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantDiversao
      ? supabase
          .from("coletas")
          .select(coletaPrevSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_DIVERSAO)
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantBolinha
      ? supabase
          .from("coletas")
          .select(coletaPrevSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_BOLINHA)
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantConsignado
      ? supabase
          .from("coletas")
          .select(coletaPrevSelect)
          .eq("empresa_id", empresaId)
          .eq("nicho_modulo", NICHO_MODULO_CONSIGNADO)
          .gte("created_at", prevStartISO)
          .lte("created_at", prevEndISO)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.furaFura
      ? queryColetasSaldoAberto(NICHO_MODULO_FURA_FURA)
      : Promise.resolve({ data: [] as never[], error: null }),
    opts.ursinho
      ? queryColetasSaldoAberto(NICHO_MODULO_URSINHO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantDiversao
      ? queryColetasSaldoAberto(NICHO_MODULO_DIVERSAO)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantBolinha
      ? queryColetasSaldoAberto(NICHO_MODULO_BOLINHA)
      : Promise.resolve({ data: [] as never[], error: null }),
    wantConsignado
      ? queryColetasSaldoAberto(NICHO_MODULO_CONSIGNADO)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  const pendenciasAbertas = await filtrarPendenciasJaQuitadas(
    supabase,
    empresaId,
    (pendenciasRes.data ?? []) as PendenciaAbertaRow[]
  );

  function somarSaldoAbertoColetas(
    rows: { valor_a_receber?: number | null; valor_pago_recebido?: number | null }[] | null
  ): number {
    return round2((rows ?? []).reduce((s, c) => s + saldoPendenteColeta(c), 0));
  }

  const estoquePendenteFura = somarSaldoAbertoColetas(saldoAbertoFuraRes.data);
  const estoquePendenteUrsinho = somarSaldoAbertoColetas(saldoAbertoUrsinhoRes.data);
  const estoquePendenteDiversao = somarSaldoAbertoColetas(saldoAbertoDiversaoRes.data);
  const estoquePendenteBolinha = somarSaldoAbertoColetas(saldoAbertoBolinhaRes.data);
  const estoquePendenteConsignado = somarSaldoAbertoColetas(saldoAbertoConsignadoRes.data);

  const estoqueItens = (estoqueRes.data ?? []).map((e) => {
    const qtd = Number(e.quantidade) || 0;
    const min = Number(e.quantidade_minima) || 0;
    const custo = Number(e.custo_unitario) || 0;
    return {
      id: e.id,
      nome: e.nome_item,
      quantidade: qtd,
      quantidadeMinima: min,
      custoUnitario: custo,
      valorTotal: round2(qtd * custo),
      abaixoMinimo: min > 0 && qtd < min,
    } satisfies EstoqueResumoItem;
  });

  const valorEstoqueCentral = round2(estoqueItens.reduce((s, i) => s + i.valorTotal, 0));
  const unidadesEstoqueCentral = estoqueItens.reduce((s, i) => s + i.quantidade, 0);

  let valorBrindesPontos = 0;
  let unidadesBrindesPontos = 0;
  const estoqueBrindesPorNome = new Map<string, { qty: number; valor: number; itemId?: string }>();

  /** item_id|nome → qty por ponto */
  const estoquePorPonto = new Map<
    string,
    { nome: string; itens: Map<string, { nome: string; quantidade: number }> }
  >();

  function addBrindeAoPonto(
    pontoId: string,
    pontoNome: string,
    b: BrindePonto
  ) {
    const qty = Math.max(0, Math.floor(Number(b.quantidade) || 0));
    const nomeItem = (b.nome || "Item").trim() || "Item";
    const key = (b.item_id || nomeItem).toLowerCase();
    let bucket = estoquePorPonto.get(pontoId);
    if (!bucket) {
      bucket = { nome: pontoNome, itens: new Map() };
      estoquePorPonto.set(pontoId, bucket);
    }
    const prev = bucket.itens.get(key);
    bucket.itens.set(key, {
      nome: prev?.nome ?? nomeItem,
      quantidade: (prev?.quantidade ?? 0) + qty,
    });
  }

  for (const p of pontosRes.data ?? []) {
    const brindes = (Array.isArray(p.estoque_brindes) ? p.estoque_brindes : []) as BrindePonto[];
    for (const b of brindes) {
      addBrindeAoPonto(p.id, p.nome, b);
      const qty = Number(b.quantidade) || 0;
      const custo = Number(b.custo_unitario) || 0;
      valorBrindesPontos += qty * custo;
      unidadesBrindesPontos += qty;
      const key = (b.item_id || b.nome || "").toLowerCase();
      if (!key) continue;
      const prev = estoqueBrindesPorNome.get(key) ?? {
        qty: 0,
        valor: 0,
        itemId: b.item_id,
      };
      prev.qty += qty;
      prev.valor += qty * custo;
      if (b.item_id) prev.itemId = b.item_id;
      estoqueBrindesPorNome.set(key, prev);
    }
    // Garante ponto com kit/fura na lista mesmo sem brindes
    if (p.kit_ativo_id && !estoquePorPonto.has(p.id)) {
      estoquePorPonto.set(p.id, { nome: p.nome, itens: new Map() });
    }
  }

  for (const eq of equipRes.data ?? []) {
    if (!eq.ponto_id) continue;
    if (
      eq.tipo !== "ursinho" &&
      eq.tipo !== "vending_ursinho" &&
      eq.tipo !== "bolinha" &&
      eq.tipo !== "consignado"
    ) {
      continue;
    }
    const pontoRel = Array.isArray(eq.pontos) ? eq.pontos[0] : eq.pontos;
    const pontoNome =
      (pontoRel as { nome?: string } | null)?.nome ??
      (pontosRes.data ?? []).find((p) => p.id === eq.ponto_id)?.nome ??
      "Ponto";
    const brindes = (Array.isArray(eq.estoque_brindes) ? eq.estoque_brindes : []) as BrindePonto[];
    if (brindes.length === 0 && !estoquePorPonto.has(eq.ponto_id)) {
      estoquePorPonto.set(eq.ponto_id, { nome: pontoNome, itens: new Map() });
    }
    for (const b of brindes) {
      addBrindeAoPonto(eq.ponto_id, pontoNome, b);
      const qty = Number(b.quantidade) || 0;
      const custo = Number(b.custo_unitario) || 0;
      valorBrindesPontos += qty * custo;
      unidadesBrindesPontos += qty;
      const key = (b.item_id || b.nome || "").toLowerCase();
      if (!key) continue;
      const prev = estoqueBrindesPorNome.get(key) ?? {
        qty: 0,
        valor: 0,
        itemId: b.item_id,
      };
      prev.qty += qty;
      prev.valor += qty * custo;
      if (b.item_id) prev.itemId = b.item_id;
      estoqueBrindesPorNome.set(key, prev);
    }
  }

  valorBrindesPontos = round2(valorBrindesPontos);

  const alertasPontos: AlertaEstoquePontoCliente[] = [];
  const pontosMeta = new Map(
    (pontosRes.data ?? []).map((p) => [
      p.id,
      {
        furos: p.furos_estoque != null ? Number(p.furos_estoque) : null,
        furosMin: p.furos_minimo != null ? Number(p.furos_minimo) : null,
        kitAtivo: Boolean(p.kit_ativo_id),
      },
    ])
  );

  for (const [pontoId, bucket] of estoquePorPonto) {
    const itens = [...bucket.itens.values()].sort((a, b) => a.nome.localeCompare(b.nome));
    const totalUnidades = itens.reduce((s, i) => s + i.quantidade, 0);
    const meta = pontosMeta.get(pontoId);
    const motivos: string[] = [];
    let severidade: "danger" | "warning" = "warning";

    if (totalUnidades === 0) {
      motivos.push("Sem brindes/itens no ponto");
      severidade = "danger";
    }
    const zerados = itens.filter((i) => i.quantidade === 0);
    if (zerados.length > 0) {
      motivos.push(`${zerados.map((i) => i.nome).join(", ")} zerado(s)`);
      severidade = "danger";
    }
    if (totalUnidades > 0 && totalUnidades <= 3) {
      motivos.push("Estoque muito baixo");
    }
    if (
      meta?.furos != null &&
      meta.furosMin != null &&
      meta.furosMin > 0 &&
      meta.furos <= meta.furosMin
    ) {
      motivos.push(`Furos baixos (${meta.furos})`);
    }

    if (motivos.length === 0) continue;

    const resumo =
      totalUnidades === 0 && itens.length === 0
        ? "0 brindes"
        : itens.map((i) => `${i.nome} ${i.quantidade}`).join(" · ") || "0 brindes";

    alertasPontos.push({
      pontoId,
      pontoNome: bucket.nome,
      totalUnidades,
      resumo,
      itens,
      severidade,
      motivos,
    });
  }

  alertasPontos.sort((a, b) => {
    if (a.severidade !== b.severidade) return a.severidade === "danger" ? -1 : 1;
    return a.totalUnidades - b.totalUnidades || a.pontoNome.localeCompare(b.pontoNome);
  });

  const maquinasCassino = (equipRes.data ?? []).filter(
    (e) => e.tipo === "cassino" && (e.status ?? "ativo") !== "inativo"
  );
  const maquinasUrsinho = (equipRes.data ?? []).filter(
    (e) =>
      (e.tipo === "ursinho" || e.tipo === "vending_ursinho") &&
      (e.status ?? "ativo") !== "inativo"
  );
  const maquinasDiversao = (equipRes.data ?? []).filter(
    (e) =>
      DIVERSAO_EQUIPAMENTO_TIPOS.includes(e.tipo as (typeof DIVERSAO_EQUIPAMENTO_TIPOS)[number]) &&
      (e.status ?? "ativo") !== "inativo"
  );
  const maquinasBolinha = (equipRes.data ?? []).filter(
    (e) => e.tipo === "bolinha" && (e.status ?? "ativo") !== "inativo"
  );
  const maquinasConsignado = (equipRes.data ?? []).filter(
    (e) => e.tipo === "consignado" && (e.status ?? "ativo") !== "inativo"
  );
  const pontosFura = (pontosRes.data ?? []).filter(
    (p) => p.furos_estoque != null || (p.preco_furo != null && Number(p.preco_furo) > 0)
  );

  // ——— Fura Fura ———
  let furaBlock: InteligenciaOperacional["furaFura"] = null;
  const rankingFura: RankingPonto[] = [];
  const rankingBrindes: RankingBrinde[] = [];
  let rankingKits: RankingKitFuros[] = [];
  let alertasBrindeKit: PontoKitAlertaBrinde[] = [];
  let furaBrutoMaquina = 0;
  let furaDinheiroOperacao = 0;
  let furaLucroLivre = 0;
  let furaLucroRecebido = 0;
  let furaCustoBrindes = 0;
  let furaRecebido = 0;
  let totalFurosMes = 0;
  const furaHaver = somarHaverFuraFuraAberto(pendenciasAbertas);

  if (opts.furaFura) {
    const mapPonto = new Map<string, RankingPonto>();
    const mapBrinde = new Map<string, RankingBrinde>();

    for (const c of coletasFuraRes.data ?? []) {
      const ponto = Array.isArray(c.pontos) ? c.pontos[0] : c.pontos;
      const brutoMaquina = Number(c.valor_bruto) || 0;
      const dinheiroOp = Number(c.valor_a_receber) || 0;
      const lucro = Number(c.lucro_real) ?? 0;
      const custo = Number(c.custo_brindes) || 0;
      const furos = Number(c.quantidade_furos) || 0;
      const pago = Number(c.valor_pago_recebido) || 0;
      const fracPago =
        dinheiroOp > 0.009 ? Math.min(1, pago / dinheiroOp) : pago > 0.009 ? 1 : 0;
      const lucroRecebidoColeta = round2(lucro * fracPago);
      furaBrutoMaquina += brutoMaquina;
      furaDinheiroOperacao += dinheiroOp;
      furaLucroLivre += lucro;
      furaLucroRecebido += lucroRecebidoColeta;
      furaCustoBrindes += custo;
      furaRecebido += pago;
      totalFurosMes += furos;

      const prev = mapPonto.get(c.ponto_id) ?? {
        pontoId: c.ponto_id,
        nome: ponto?.nome ?? "Ponto",
        cidade: null,
        lucro: 0,
        bruto: 0,
        dinheiroOperacao: 0,
        custoBrindes: 0,
        movimentos: 0,
        comissao: 0,
        entrada: 0,
        saida: 0,
        nicho: "fura_fura" as const,
      };
      prev.lucro += lucroRecebidoColeta;
      prev.bruto += brutoMaquina;
      prev.dinheiroOperacao += dinheiroOp;
      prev.custoBrindes += custo;
      prev.comissao = (prev.comissao ?? 0) + Math.max(0, brutoMaquina - dinheiroOp);
      prev.entrada = (prev.entrada ?? 0) + brutoMaquina;
      prev.movimentos++;
      mapPonto.set(c.ponto_id, prev);

      for (const b of parseBrindesSalvos(c.brindes_entregues)) {
        const key = b.nome.trim().toLowerCase();
        const bp = mapBrinde.get(key) ?? {
          nome: b.nome,
          itemId: b.item_id,
          entregues: 0,
          custoTotal: 0,
          coletasComEntrega: 0,
          estoquePontos: 0,
          valorEstoquePontos: 0,
          lucroAssociado: 0,
        };
        bp.entregues += b.quantidade;
        bp.custoTotal += b.quantidade * b.custo_unitario;
        bp.coletasComEntrega++;
        bp.lucroAssociado += lucroRecebidoColeta;
        mapBrinde.set(key, bp);
      }
    }

    for (const [key, est] of estoqueBrindesPorNome) {
      const bp = mapBrinde.get(key) ?? {
        nome: key,
        entregues: 0,
        custoTotal: 0,
        coletasComEntrega: 0,
        estoquePontos: 0,
        valorEstoquePontos: 0,
        lucroAssociado: 0,
      };
      bp.estoquePontos = est.qty;
      bp.valorEstoquePontos = round2(est.valor);
      mapBrinde.set(key, bp);
    }

    rankingFura.push(...mapPonto.values());
    rankingBrindes.push(...mapBrinde.values());
    rankingFura.sort((a, b) => b.lucro - a.lucro);
    rankingBrindes.sort((a, b) => b.entregues - a.entregues);

    rankingKits = rankingKitsPorFuros(coletasFuraRes.data ?? []);
    alertasBrindeKit = alertasBrindeAnormal(coletasFuraRes.data ?? []);

    const eventosFura = coletasToEventosPonto(
      (coletasFuraRes.data ?? []).map((c) => ({
        id: c.id,
        ponto_id: c.ponto_id,
        visita_id: null,
        created_at: c.created_at,
        lucro_centavos: null,
        lucro_real: c.lucro_real,
        valor_liquido: null,
        valor_bruto: c.valor_bruto,
        entrada: null,
        pontos: c.pontos,
      }))
    );

    const saudeMap = new Map<string, PontoSaudeItem>();
    for (const e of eventosFura) {
      const prev = saudeMap.get(e.ponto_id) ?? {
        pontoId: e.ponto_id,
        nome: e.ponto_nome,
        classe: "sem_dados" as SaudePontoClasse,
        indice: null,
        lucroMes: 0,
        impulsos: 0,
        pressoes: 0,
        visitas: 0,
      };
      prev.visitas++;
      prev.lucroMes += e.lucroReais;
      if (e.negativa || e.lucroReais < -0.009) prev.pressoes++;
      else if (e.lucroReais > 0.009) prev.impulsos++;
      saudeMap.set(e.ponto_id, prev);
    }
    enriquecerSaudeMap(saudeMap);

    furaBlock = {
      caixa: {
        brutoMaquina: round2(furaBrutoMaquina),
        dinheiroOperacao: round2(furaDinheiroOperacao),
        reservaBrindes: round2(furaCustoBrindes),
        lucroLivre: round2(furaLucroLivre),
        lucroRecebido: round2(furaLucroRecebido),
        recebido: round2(furaRecebido),
        pendenteReceber: estoquePendenteFura,
        haver: furaHaver,
      },
      totalFuros: totalFurosMes,
      coletas: (coletasFuraRes.data ?? []).length,
      rankingPontos: rankingFura,
      rankingBrindes,
      rankingKits,
      alertasBrindeKit,
      saudePontos: [...saudeMap.values()].sort((a, b) => b.lucroMes - a.lucroMes),
    };
  }

  // ——— Cassino ———
  let cassinoBlock: InteligenciaOperacional["cassino"] = null;
  const rankingCassino: RankingPonto[] = [];

  if (opts.cassino) {
    const mapPonto = new Map<string, RankingPonto>();
    let cassinoLucro = 0;
    let cassinoComissao = 0;
    // Entrada/saída a partir das coletas (centavos — convertidos ao montar o bloco).
    let cassinoEntrada = 0;
    let cassinoSaida = 0;
    const openOpByVisita = mapaPendenciaOperacaoAberta(pendenciasAbertas);
    for (const c of coletasCassinoRes.data ?? []) {
      cassinoEntrada += Number(c.entrada_periodo ?? 0);
      cassinoSaida += Number(c.saida_periodo ?? 0);
    }

    for (const v of visitasRes.data ?? []) {
      const ponto = Array.isArray(v.pontos) ? v.pontos[0] : v.pontos;
      const lucroMaquina = centesimosToReais(Number(v.total_lucro_centavos ?? 0));
      const lucroOperacaoGerado = Number(
        (v as { valor_operacao?: number | null }).valor_operacao ?? lucroMaquina
      );
      const lucroOperacao = liquidoRecebidoCassinoVisita(
        v,
        openOpByVisita.get(v.id) ?? 0
      );
      const visitaNegativa = Boolean(
        (v as { saldo_negativo?: boolean | null }).saldo_negativo
      ) || lucroMaquina < -0.009;
      // Negativo não paga comissão; positiva usa valor_cliente (fallback: lucro − operação).
      const comissaoVisita = visitaNegativa
        ? 0
        : Math.max(
            0,
            Number((v as { valor_cliente?: number | null }).valor_cliente ?? 0) ||
              lucroMaquina - lucroOperacaoGerado
          );
      cassinoLucro += lucroOperacao;
      cassinoComissao += comissaoVisita;
      const entradaVisita = Number(v.total_entrada_periodo ?? 0) / 100;
      const saidaVisita = Number(v.total_saida_periodo ?? 0) / 100;

      const prev = mapPonto.get(v.ponto_id) ?? {
        pontoId: v.ponto_id,
        nome: ponto?.nome ?? "Ponto",
        cidade: null,
        lucro: 0,
        bruto: 0,
        dinheiroOperacao: 0,
        custoBrindes: 0,
        movimentos: 0,
        comissao: 0,
        entrada: 0,
        saida: 0,
        nicho: "cassino" as const,
      };
      prev.lucro += lucroOperacao;
      prev.dinheiroOperacao += lucroOperacao;
      prev.bruto += entradaVisita;
      prev.entrada = (prev.entrada ?? 0) + entradaVisita;
      prev.saida = (prev.saida ?? 0) + saidaVisita;
      prev.comissao = (prev.comissao ?? 0) + comissaoVisita;
      prev.movimentos++;
      mapPonto.set(v.ponto_id, prev);
    }
    rankingCassino.push(...[...mapPonto.values()].map(enrichRankingPonto));
    rankingCassino.sort((a, b) => b.lucro - a.lucro);

    const mapMaquina = new Map<string, RankingMaquina>();
    const mapJogo = new Map<string, RankingJogo>();

    for (const c of coletasCassinoRes.data ?? []) {
      const eq = Array.isArray(c.equipamentos) ? c.equipamentos[0] : c.equipamentos;
      if (!eq?.id) continue;
      const ponto = Array.isArray(eq.pontos) ? eq.pontos[0] : eq.pontos;
      const entrada = Number(c.entrada_periodo ?? 0);
      const saida = Number(c.saida_periodo ?? 0);
      const lucro = centesimosToReais(Number(c.lucro_centavos ?? 0));

      const prevM = mapMaquina.get(eq.id) ?? {
        equipamentoId: eq.id,
        nome: eq.nome,
        numeroMaquina: eq.numero_maquina,
        tipo: (eq.tipo as RankingMaquina["tipo"]) ?? null,
        pontoId: eq.ponto_id,
        pontoNome: ponto?.nome ?? "Ponto",
        lucro: 0,
        entrada: 0,
        saida: 0,
        pctPago: null,
        leituras: 0,
      };
      prevM.lucro += lucro;
      prevM.entrada += entrada;
      prevM.saida += saida;
      prevM.leituras++;
      prevM.pctPago = pctPago(prevM.entrada, prevM.saida);
      mapMaquina.set(eq.id, prevM);

      const jogoKey = eq.nome.trim().toLowerCase();
      const prevJ = mapJogo.get(jogoKey) ?? {
        nome: eq.nome,
        lucro: 0,
        entrada: 0,
        saida: 0,
        pctPago: null,
        maquinas: 0,
        leituras: 0,
      };
      prevJ.lucro += lucro;
      prevJ.entrada += entrada;
      prevJ.saida += saida;
      prevJ.leituras++;
      prevJ.pctPago = pctPago(prevJ.entrada, prevJ.saida);
      mapJogo.set(jogoKey, prevJ);
    }

    const maquinasIds = new Set(mapMaquina.keys());
    for (const j of mapJogo.values()) {
      j.maquinas = [...mapMaquina.values()].filter(
        (m) => m.nome.trim().toLowerCase() === j.nome.trim().toLowerCase()
      ).length;
    }

    const eventosCassino = visitasToEventosPonto(visitasRes.data ?? [], {
      usarValorOperacao: true,
    });
    const saudeMap = new Map<string, PontoSaudeItem>();
    for (const e of eventosCassino) {
      const prev = saudeMap.get(e.ponto_id) ?? {
        pontoId: e.ponto_id,
        nome: e.ponto_nome,
        classe: "sem_dados" as SaudePontoClasse,
        indice: null,
        lucroMes: 0,
        impulsos: 0,
        pressoes: 0,
        visitas: 0,
      };
      prev.visitas++;
      prev.lucroMes += e.lucroReais;
      if (e.negativa || e.lucroReais < -0.009) prev.pressoes++;
      else if (e.lucroReais > 0.009) prev.impulsos++;
      saudeMap.set(e.ponto_id, prev);
    }
    enriquecerSaudeMap(saudeMap);

    cassinoBlock = {
      lucro: round2(cassinoLucro),
      comissao: round2(cassinoComissao),
      entrada: cassinoEntrada,
      saida: cassinoSaida,
      visitas: (visitasRes.data ?? []).length,
      rankingPontos: rankingCassino,
      rankingMaquinas: [...mapMaquina.values()].sort((a, b) => b.lucro - a.lucro),
      rankingJogos: [...mapJogo.values()].sort((a, b) => b.entrada - a.entrada),
      saudePontos: [...saudeMap.values()].sort((a, b) => b.lucroMes - a.lucroMes),
    };

    void maquinasIds;
  }

  // ——— Ursinho ———
  let ursinhoBlock: InteligenciaOperacional["ursinho"] = null;
  const rankingUrsinho: RankingPonto[] = [];
  const rankingBrindesUrsinho: RankingBrinde[] = [];
  let rankingMaquinasUrsinho: RankingMaquina[] = [];

  if (opts.ursinho) {
    const mapPonto = new Map<string, RankingPonto>();
    const mapBrinde = new Map<string, RankingBrinde>();
    const mapMaquina = new Map<string, RankingMaquina>();

    let ursoBrutoMaquina = 0;
    let ursoDinheiroOperacao = 0;
    let ursoLucroLivre = 0;
    let ursoLucroRecebido = 0;
    let ursoCustoBrindes = 0;
    let ursoRecebido = 0;

    for (const c of coletasUrsinhoRes.data ?? []) {
      const ponto = Array.isArray(c.pontos) ? c.pontos[0] : c.pontos;
      const eq = Array.isArray(c.equipamentos) ? c.equipamentos[0] : c.equipamentos;
      const brutoMaquina = Number(c.valor_bruto) || 0;
      const dinheiroOp = Number(c.valor_a_receber) || 0;
      const lucro = Number(c.lucro_real) ?? 0;
      const custo = Number(c.custo_brindes) || 0;
      const entrada =
        c.entrada_periodo != null
          ? Number(c.entrada_periodo)
          : Math.round(brutoMaquina * 100);
      const pago = Number(c.valor_pago_recebido) || 0;
      const fracPago =
        dinheiroOp > 0.009 ? Math.min(1, pago / dinheiroOp) : pago > 0.009 ? 1 : 0;
      const lucroRecebidoColeta = round2(lucro * fracPago);

      ursoBrutoMaquina += brutoMaquina;
      ursoDinheiroOperacao += dinheiroOp;
      ursoLucroLivre += lucro;
      ursoLucroRecebido += lucroRecebidoColeta;
      ursoCustoBrindes += custo;
      ursoRecebido += pago;

      if (c.ponto_id) {
        const prev = mapPonto.get(c.ponto_id) ?? {
          pontoId: c.ponto_id,
          nome: ponto?.nome ?? "Ponto",
          cidade: null,
          lucro: 0,
          bruto: 0,
          dinheiroOperacao: 0,
          custoBrindes: 0,
          movimentos: 0,
          comissao: 0,
          entrada: 0,
          saida: 0,
          nicho: "ursinho" as const,
        };
        prev.lucro += lucroRecebidoColeta;
        prev.bruto += brutoMaquina;
        prev.dinheiroOperacao += dinheiroOp;
        prev.custoBrindes += custo;
        prev.comissao = (prev.comissao ?? 0) + Math.max(0, brutoMaquina - dinheiroOp);
        prev.entrada =
          (prev.entrada ?? 0) +
          (c.entrada_periodo != null ? centesimosToReais(Number(c.entrada_periodo)) : brutoMaquina);
        prev.movimentos++;
        mapPonto.set(c.ponto_id, prev);
      }

      if (eq?.id) {
        const eqPonto = Array.isArray(eq.pontos) ? eq.pontos[0] : eq.pontos;
        const prevM = mapMaquina.get(eq.id) ?? {
          equipamentoId: eq.id,
          nome: eq.nome,
          numeroMaquina: eq.numero_maquina,
          tipo: (eq.tipo === "vending_ursinho" ? "vending_ursinho" : "ursinho") as RankingMaquina["tipo"],
          pontoId: eq.ponto_id ?? c.ponto_id,
          pontoNome: eqPonto?.nome ?? ponto?.nome ?? "Ponto",
          lucro: 0,
          entrada: 0,
          saida: 0,
          pctPago: null,
          leituras: 0,
        };
        prevM.lucro += lucroRecebidoColeta;
        prevM.entrada += entrada;
        prevM.leituras++;
        mapMaquina.set(eq.id, prevM);
      }

      for (const b of parseBrindesSalvos(c.brindes_entregues)) {
        const key = b.nome.trim().toLowerCase();
        const bp = mapBrinde.get(key) ?? {
          nome: b.nome,
          itemId: b.item_id,
          entregues: 0,
          custoTotal: 0,
          coletasComEntrega: 0,
          estoquePontos: 0,
          valorEstoquePontos: 0,
          lucroAssociado: 0,
        };
        bp.entregues += b.quantidade;
        bp.custoTotal += b.quantidade * b.custo_unitario;
        bp.coletasComEntrega++;
        bp.lucroAssociado += lucroRecebidoColeta;
        mapBrinde.set(key, bp);
      }
    }

    rankingUrsinho.push(...mapPonto.values());
    rankingBrindesUrsinho.push(...mapBrinde.values());
    rankingUrsinho.sort((a, b) => b.lucro - a.lucro);
    rankingBrindesUrsinho.sort((a, b) => b.entregues - a.entregues);
    rankingMaquinasUrsinho = [...mapMaquina.values()].sort((a, b) => b.lucro - a.lucro);

    const eventosUrso = coletasToEventosPonto(
      (coletasUrsinhoRes.data ?? []).map((c) => ({
        id: c.id,
        ponto_id: c.ponto_id,
        visita_id: null,
        created_at: c.created_at,
        lucro_centavos: null,
        lucro_real: c.lucro_real,
        valor_liquido: null,
        valor_bruto: c.valor_bruto,
        entrada: null,
        pontos: c.pontos,
      }))
    );

    const saudeMap = new Map<string, PontoSaudeItem>();
    for (const e of eventosUrso) {
      const prev = saudeMap.get(e.ponto_id) ?? {
        pontoId: e.ponto_id,
        nome: e.ponto_nome,
        classe: "sem_dados" as SaudePontoClasse,
        indice: null,
        lucroMes: 0,
        impulsos: 0,
        pressoes: 0,
        visitas: 0,
      };
      prev.visitas++;
      prev.lucroMes += e.lucroReais;
      if (e.negativa || e.lucroReais < -0.009) prev.pressoes++;
      else if (e.lucroReais > 0.009) prev.impulsos++;
      saudeMap.set(e.ponto_id, prev);
    }
    enriquecerSaudeMap(saudeMap);

    ursinhoBlock = {
      caixa: {
        brutoMaquina: round2(ursoBrutoMaquina),
        dinheiroOperacao: round2(ursoDinheiroOperacao),
        reservaBrindes: round2(ursoCustoBrindes),
        lucroLivre: round2(ursoLucroLivre),
        lucroRecebido: round2(ursoLucroRecebido),
        recebido: round2(ursoRecebido),
        pendenteReceber: estoquePendenteUrsinho,
        haver: 0,
      },
      coletas: (coletasUrsinhoRes.data ?? []).length,
      totalMaquinas: maquinasUrsinho.length,
      rankingPontos: rankingUrsinho,
      rankingMaquinas: rankingMaquinasUrsinho,
      rankingBrindes: rankingBrindesUrsinho,
      saudePontos: [...saudeMap.values()].sort((a, b) => b.lucroMes - a.lucroMes),
    };
  }

  const diversaoBlock = wantDiversao
    ? agregarNichoColetaAnalise((coletasDiversaoRes.data ?? []) as ColetaNichoRow[], {
        nicho: "diversao",
        totalMaquinas: maquinasDiversao.length,
        comBrindes: false,
        tipoFallback: "diversao",
      })
    : null;
  if (diversaoBlock) {
    diversaoBlock.caixa.pendenteReceber = estoquePendenteDiversao;
  }

  const bolinhaBlock = wantBolinha
    ? agregarNichoColetaAnalise((coletasBolinhaRes.data ?? []) as ColetaNichoRow[], {
        nicho: "bolinha",
        totalMaquinas: maquinasBolinha.length,
        comBrindes: true,
        tipoFallback: "bolinha",
      })
    : null;
  if (bolinhaBlock) {
    bolinhaBlock.caixa.pendenteReceber = estoquePendenteBolinha;
  }

  const consignadoBlock = wantConsignado
    ? agregarNichoColetaAnalise((coletasConsignadoRes.data ?? []) as ColetaNichoRow[], {
        nicho: "consignado",
        totalMaquinas: maquinasConsignado.length,
        comBrindes: true,
        tipoFallback: "consignado",
      })
    : null;
  if (consignadoBlock) {
    consignadoBlock.caixa.pendenteReceber = estoquePendenteConsignado;
  }

  const rankingDiversao = diversaoBlock?.rankingPontos ?? [];
  const rankingBolinha = bolinhaBlock?.rankingPontos ?? [];
  const rankingConsignado = consignadoBlock?.rankingPontos ?? [];

  // Bruto / entrada = máquinas; liquidoOperacao = só o que já foi recebido (regra caixa).
  const entradaCassinoReais = round2((cassinoBlock?.entrada ?? 0) / 100);
  const saidaCassinoReais = round2((cassinoBlock?.saida ?? 0) / 100);
  const entrada = round2(
    (furaBlock?.caixa.brutoMaquina ?? 0) +
      (ursinhoBlock?.caixa.brutoMaquina ?? 0) +
      (diversaoBlock?.caixa.brutoMaquina ?? 0) +
      (bolinhaBlock?.caixa.brutoMaquina ?? 0) +
      (consignadoBlock?.caixa.brutoMaquina ?? 0) +
      entradaCassinoReais
  );
  const saida = saidaCassinoReais;
  const liquidoMovimento = round2(entrada - saida);
  const comissaoColeta = round2(
    Math.max(0, (furaBlock?.caixa.brutoMaquina ?? 0) - (furaBlock?.caixa.dinheiroOperacao ?? 0)) +
      Math.max(
        0,
        (ursinhoBlock?.caixa.brutoMaquina ?? 0) - (ursinhoBlock?.caixa.dinheiroOperacao ?? 0)
      ) +
      Math.max(
        0,
        (diversaoBlock?.caixa.brutoMaquina ?? 0) - (diversaoBlock?.caixa.dinheiroOperacao ?? 0)
      ) +
      Math.max(
        0,
        (bolinhaBlock?.caixa.brutoMaquina ?? 0) - (bolinhaBlock?.caixa.dinheiroOperacao ?? 0)
      ) +
      Math.max(
        0,
        (consignadoBlock?.caixa.brutoMaquina ?? 0) - (consignadoBlock?.caixa.dinheiroOperacao ?? 0)
      )
  );
  // Comissão cassino = soma por visita positiva (não misturar com negativo do período).
  const comissaoCassinoReal = round2(cassinoBlock?.comissao ?? 0);
  const comissao = round2(comissaoColeta + comissaoCassinoReal);

  const faturamentoBruto = entrada;
  const liquidoOperacao = round2(
    (furaBlock?.caixa.lucroRecebido ?? 0) +
      (ursinhoBlock?.caixa.lucroRecebido ?? 0) +
      (diversaoBlock?.caixa.lucroRecebido ?? 0) +
      (bolinhaBlock?.caixa.lucroRecebido ?? 0) +
      (consignadoBlock?.caixa.lucroRecebido ?? 0) +
      (cassinoBlock?.lucro ?? 0)
  );
  const lucroLiquido = liquidoOperacao;

  const pendSums = somarPendenciasPorNicho(pendenciasAbertas);
  const cassinoAReceberVisitas = round2(
    (visitasRes.data ?? [])
      .filter((v) => !v.saldo_negativo)
      .reduce((s, v) => s + cobravelCassinoVisita(v), 0)
  );
  // Estoque de dívida aberta (coletas) por nicho; Math.max evita double-count com
  // pendências espelhadas ("Coleta X pendente") na tabela pendencias.
  // Cassino: cobravel das visitas (fonte do Quitada), não a tabela pendencias.
  const aReceber = round2(
    Math.max(furaBlock?.caixa.pendenteReceber ?? 0, pendSums.furaPendente) +
      Math.max(ursinhoBlock?.caixa.pendenteReceber ?? 0, pendSums.ursinhoPendente) +
      Math.max(diversaoBlock?.caixa.pendenteReceber ?? 0, pendSums.diversaoPendente) +
      Math.max(bolinhaBlock?.caixa.pendenteReceber ?? 0, pendSums.bolinhaPendente) +
      Math.max(consignadoBlock?.caixa.pendenteReceber ?? 0, pendSums.consignadoPendente) +
      cassinoAReceberVisitas +
      pendSums.pontoPendente
  );
  const haver = round2(
    pendSums.cassinoHaver +
      pendSums.furaHaver +
      pendSums.ursinhoHaver +
      pendSums.diversaoHaver +
      pendSums.bolinhaHaver +
      pendSums.consignadoHaver
  );
  const custoBrindesMes = round2(
    (furaBlock?.caixa.reservaBrindes ?? 0) +
      (ursinhoBlock?.caixa.reservaBrindes ?? 0) +
      (bolinhaBlock?.caixa.reservaBrindes ?? 0) +
      (consignadoBlock?.caixa.reservaBrindes ?? 0)
  );
  const margemPct = entrada > 0 ? round2((liquidoOperacao / entrada) * 100) : null;

  const movimentosAtual =
    (furaBlock?.coletas ?? 0) +
    (cassinoBlock?.visitas ?? 0) +
    (ursinhoBlock?.coletas ?? 0) +
    (diversaoBlock?.coletas ?? 0) +
    (bolinhaBlock?.coletas ?? 0) +
    (consignadoBlock?.coletas ?? 0);

  function somarPrevColetas(
    rows: {
      lucro_real?: number | null;
      valor_bruto?: number | null;
      entrada_periodo?: number | null;
      valor_a_receber?: number | null;
      valor_pago_recebido?: number | null;
    }[]
  ) {
    let lucro = 0;
    let entradaPrev = 0;
    for (const c of rows) {
      const lucroLivre = Number(c.lucro_real) || 0;
      const aReceber = Number(c.valor_a_receber) || 0;
      const pago = Number(c.valor_pago_recebido) || 0;
      const frac =
        aReceber > 0.009 ? Math.min(1, pago / aReceber) : pago > 0.009 ? 1 : 0;
      lucro += round2(lucroLivre * frac);
      entradaPrev +=
        c.entrada_periodo != null
          ? centesimosToReais(Number(c.entrada_periodo))
          : Number(c.valor_bruto) || 0;
    }
    return { lucro, entrada: entradaPrev, movimentos: rows.length };
  }

  const prevFura = somarPrevColetas(prevColetasFuraRes.data ?? []);
  const prevUrso = somarPrevColetas(prevColetasUrsinhoRes.data ?? []);
  const prevDiversao = somarPrevColetas(prevColetasDiversaoRes.data ?? []);
  const prevBolinha = somarPrevColetas(prevColetasBolinhaRes.data ?? []);
  const prevConsignado = somarPrevColetas(prevColetasConsignadoRes.data ?? []);
  const openOpByVisitaPrev = mapaPendenciaOperacaoAberta(pendenciasAbertas);
  const prevCassinoLucro = (prevVisitasRes.data ?? []).reduce(
    (s, v) => s + liquidoRecebidoCassinoVisita(v, openOpByVisitaPrev.get(v.id) ?? 0),
    0
  );
  const prevCassinoEntrada = (prevColetasCassinoRes.data ?? []).reduce(
    (s, c) => s + centesimosToReais(Number(c.entrada_periodo ?? 0)),
    0
  );
  const liquidoOperacaoAnterior = round2(
    prevFura.lucro +
      prevUrso.lucro +
      prevDiversao.lucro +
      prevBolinha.lucro +
      prevConsignado.lucro +
      prevCassinoLucro
  );
  const entradaAnterior = round2(
    prevFura.entrada +
      prevUrso.entrada +
      prevDiversao.entrada +
      prevBolinha.entrada +
      prevConsignado.entrada +
      prevCassinoEntrada
  );
  const movimentosAnterior =
    prevFura.movimentos +
    prevUrso.movimentos +
    prevDiversao.movimentos +
    prevBolinha.movimentos +
    prevConsignado.movimentos +
    (prevVisitasRes.data ?? []).length;

  const liquidoOperacaoDelta = round2(liquidoOperacao - liquidoOperacaoAnterior);
  const comparativo: InteligenciaOperacional["comparativo"] = {
    labelAnterior: prevPeriodo.label,
    liquidoOperacaoAnterior,
    liquidoOperacaoDelta,
    liquidoOperacaoDeltaPct:
      Math.abs(liquidoOperacaoAnterior) > 0.009
        ? round2((liquidoOperacaoDelta / Math.abs(liquidoOperacaoAnterior)) * 100)
        : null,
    entradaAnterior,
    entradaDelta: round2(entrada - entradaAnterior),
    movimentosAnterior,
    movimentosDelta: movimentosAtual - movimentosAnterior,
  };

  const pontosAtencao: PontoAtencao[] = [];
  const pontoNomes = new Map((pontosRes.data ?? []).map((p) => [p.id, p.nome]));
  const pontoCidades = new Map(
    (pontosRes.data ?? []).map((p) => [
      p.id,
      typeof p.cidade === "string" && p.cidade.trim() ? p.cidade.trim() : null,
    ])
  );

  function aplicarCidade(list: RankingPonto[]) {
    for (const r of list) {
      r.cidade = pontoCidades.get(r.pontoId) ?? r.cidade ?? null;
    }
  }
  aplicarCidade(rankingFura);
  aplicarCidade(rankingCassino);
  aplicarCidade(rankingUrsinho);
  aplicarCidade(rankingDiversao);
  aplicarCidade(rankingBolinha);
  aplicarCidade(rankingConsignado);

  const rankingPontos = consolidarRankingPontos([
    ...rankingFura,
    ...rankingCassino,
    ...rankingUrsinho,
    ...rankingDiversao,
    ...rankingBolinha,
    ...rankingConsignado,
  ]);
  const rankingCidades = agregarRankingCidades(rankingPontos, lucroLiquido);

  const mergeSaude = [
    ...(furaBlock?.saudePontos ?? []),
    ...(cassinoBlock?.saudePontos ?? []),
    ...(ursinhoBlock?.saudePontos ?? []),
    ...(diversaoBlock?.saudePontos ?? []),
    ...(bolinhaBlock?.saudePontos ?? []),
    ...(consignadoBlock?.saudePontos ?? []),
  ];
  const atencaoMap = new Map<string, PontoAtencao>();

  for (const s of mergeSaude) {
    const motivos: string[] = [];
    let score = 0;
    if (s.classe === "fraco") {
      motivos.push("Saúde fraca");
      score += 40;
    }
    if (s.lucroMes < -0.009) {
      motivos.push(`Prejuízo ${formatCurrency(Math.abs(s.lucroMes))}`);
      score += 30;
    }
    if (s.pressoes > s.impulsos) {
      motivos.push("Mais pressão que impulso");
      score += 20;
    }
    if (score === 0 && s.classe === "razoavel" && s.lucroMes < 50) {
      motivos.push("Margem baixa");
      score += 10;
    }
    if (score === 0) continue;

    const prev = atencaoMap.get(s.pontoId);
    if (!prev || score > prev.score) {
      atencaoMap.set(s.pontoId, {
        pontoId: s.pontoId,
        nome: s.nome,
        motivos,
        lucroMes: s.lucroMes,
        classe: s.classe,
        score,
      });
    }
  }

  for (const p of pontosRes.data ?? []) {
    if ((p.status ?? "ativo") === "inativo") continue;
    const temFura = p.furos_estoque != null;
    const temColetaFura = rankingFura.some((r) => r.pontoId === p.id);
    const temVisitaCassino = rankingCassino.some((r) => r.pontoId === p.id);
    if (temFura && !temColetaFura && opts.furaFura) {
      atencaoMap.set(p.id, {
        pontoId: p.id,
        nome: p.nome,
        motivos: ["Sem coleta fura-fura no mês"],
        lucroMes: 0,
        classe: "sem_dados",
        score: 25,
      });
    }
    if (!temVisitaCassino && opts.cassino && maquinasCassino.some((m) => m.ponto_id === p.id)) {
      const prev = atencaoMap.get(p.id);
      const motivos = [...(prev?.motivos ?? []), "Máquina cassino sem visita no mês"];
      atencaoMap.set(p.id, {
        pontoId: p.id,
        nome: p.nome,
        motivos,
        lucroMes: prev?.lucroMes ?? 0,
        classe: prev?.classe ?? "sem_dados",
        score: (prev?.score ?? 0) + 25,
      });
    }
    const temColetaUrso = rankingUrsinho.some((r) => r.pontoId === p.id);
    if (!temColetaUrso && opts.ursinho && maquinasUrsinho.some((m) => m.ponto_id === p.id)) {
      const prev = atencaoMap.get(p.id);
      const motivos = [...(prev?.motivos ?? []), "Máquina ursinho sem coleta no período"];
      atencaoMap.set(p.id, {
        pontoId: p.id,
        nome: p.nome,
        motivos,
        lucroMes: prev?.lucroMes ?? 0,
        classe: prev?.classe ?? "sem_dados",
        score: (prev?.score ?? 0) + 25,
      });
    }
    if (
      wantDiversao &&
      !rankingDiversao.some((r) => r.pontoId === p.id) &&
      maquinasDiversao.some((m) => m.ponto_id === p.id)
    ) {
      const prev = atencaoMap.get(p.id);
      const motivos = [...(prev?.motivos ?? []), "Diversão sem coleta no período"];
      atencaoMap.set(p.id, {
        pontoId: p.id,
        nome: p.nome,
        motivos,
        lucroMes: prev?.lucroMes ?? 0,
        classe: prev?.classe ?? "sem_dados",
        score: (prev?.score ?? 0) + 25,
      });
    }
    if (
      wantBolinha &&
      !rankingBolinha.some((r) => r.pontoId === p.id) &&
      maquinasBolinha.some((m) => m.ponto_id === p.id)
    ) {
      const prev = atencaoMap.get(p.id);
      const motivos = [...(prev?.motivos ?? []), "Bolinha sem coleta no período"];
      atencaoMap.set(p.id, {
        pontoId: p.id,
        nome: p.nome,
        motivos,
        lucroMes: prev?.lucroMes ?? 0,
        classe: prev?.classe ?? "sem_dados",
        score: (prev?.score ?? 0) + 25,
      });
    }
    if (
      wantConsignado &&
      !rankingConsignado.some((r) => r.pontoId === p.id) &&
      maquinasConsignado.some((m) => m.ponto_id === p.id)
    ) {
      const prev = atencaoMap.get(p.id);
      const motivos = [...(prev?.motivos ?? []), "Consignado sem coleta no período"];
      atencaoMap.set(p.id, {
        pontoId: p.id,
        nome: p.nome,
        motivos,
        lucroMes: prev?.lucroMes ?? 0,
        classe: prev?.classe ?? "sem_dados",
        score: (prev?.score ?? 0) + 25,
      });
    }
  }

  pontosAtencao.push(
    ...[...atencaoMap.values()].sort((a, b) => b.score - a.score || a.lucroMes - b.lucroMes)
  );

  void pontoNomes;

  const fura90Rows = coletasFura90Res.data ?? [];
  let fura90Brindes = 0;
  let fura90Lucro = 0;
  for (const c of fura90Rows) {
    fura90Lucro += Number(c.lucro_real) || 0;
    for (const b of parseBrindesSalvos(c.brindes_entregues)) {
      fura90Brindes += b.quantidade;
    }
  }

  const saudePontosMap = new Map<string, PontoSaudeItem>();
  for (const s of mergeSaude) {
    const prev = saudePontosMap.get(s.pontoId);
    if (!prev) {
      saudePontosMap.set(s.pontoId, { ...s });
    } else if ((s.visitas ?? 0) > 0 || Math.abs(s.lucroMes) > 0.009) {
      prev.lucroMes += s.lucroMes;
      prev.impulsos += s.impulsos;
      prev.pressoes += s.pressoes;
      prev.visitas += s.visitas;
      if (prev.classe === "sem_dados" && s.classe !== "sem_dados") {
        prev.classe = s.classe;
        prev.indice = s.indice;
      }
    }
  }
  const saudePontos = finalizarSaudeMap(saudePontosMap).sort(
    (a, b) => b.lucroMes - a.lucroMes
  );

  const visaoGeral: InteligenciaOperacional["visaoGeral"] = {
    faturamentoBruto,
    lucroLiquido,
    entrada,
    saida,
    comissao,
    liquidoMovimento,
    liquidoOperacao,
    custoBrindesMes,
    margemPct,
    valorEstoqueCentral,
    unidadesEstoqueCentral,
    valorBrindesPontos,
    unidadesBrindesPontos,
    totalMaquinasCassino: maquinasCassino.length,
    totalMaquinasUrsinho: maquinasUrsinho.length,
    totalMaquinasDiversao: maquinasDiversao.length,
    totalMaquinasBolinha: maquinasBolinha.length,
    totalMaquinasConsignado: maquinasConsignado.length,
    totalPontosFura: pontosFura.length,
    totalFurosMes,
    aReceber,
    haver,
    movimentos: movimentosAtual,
  };

  const insights = gerarInsights({
    rankingFura,
    rankingCassino,
    rankingUrsinho,
    rankingBrindes,
    rankingBrindesUrsinho,
    rankingKits,
    alertasBrindeKit,
    rankingMaquinas: cassinoBlock?.rankingMaquinas ?? [],
    rankingMaquinasUrsinho,
    estoque: estoqueItens,
    alertasPontos,
    pontosAtencao,
    visao: visaoGeral,
    comparativo,
    fura90: opts.furaFura
      ? {
          coletas: fura90Rows.length,
          lucro: round2(fura90Lucro),
          brindesEntregues: fura90Brindes,
        }
      : undefined,
  });

  return {
    periodoLabel: periodo.label,
    periodoPreset: periodo.preset,
    nichos: {
      cassino: opts.cassino,
      furaFura: opts.furaFura,
      ursinho: opts.ursinho,
      diversao: wantDiversao,
      bolinha: wantBolinha,
      consignado: wantConsignado,
    },
    visaoGeral,
    comparativo,
    saudePontos,
    rankingPontos,
    rankingCidades,
    furaFura: furaBlock,
    cassino: cassinoBlock,
    ursinho: ursinhoBlock,
    diversao: diversaoBlock,
    bolinha: bolinhaBlock,
    consignado: consignadoBlock,
    estoque: {
      itens: estoqueItens.sort((a, b) => b.valorTotal - a.valorTotal),
      valorTotal: valorEstoqueCentral,
      itensAbaixoMinimo: estoqueItens.filter((i) => i.abaixoMinimo).length,
      alertasPontos,
    },
    pontosAtencao,
    insights,
  };
}
