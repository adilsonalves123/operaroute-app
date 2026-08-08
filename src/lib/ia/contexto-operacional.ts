import type { InteligenciaOperacional } from "@/lib/analise/inteligencia-operacional";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";

export type ContextoIAPersonalizada = {
  nomeOperacao: string;
  periodoLabel: string;
  nichos: InteligenciaOperacional["nichos"];
  visao: InteligenciaOperacional["visaoGeral"];
  comparativo: InteligenciaOperacional["comparativo"];
  rankingCidades: InteligenciaOperacional["rankingCidades"];
  rankingPontos: InteligenciaOperacional["rankingPontos"];
  furaFura: NonNullable<InteligenciaOperacional["furaFura"]> | null;
  cassino: InteligenciaOperacional["cassino"];
  ursinho: InteligenciaOperacional["ursinho"];
  diversao: InteligenciaOperacional["diversao"];
  bolinha: InteligenciaOperacional["bolinha"];
  consignado: InteligenciaOperacional["consignado"];
  pontosAtencao: InteligenciaOperacional["pontosAtencao"];
  estoqueAbaixoMinimo: InteligenciaOperacional["estoque"]["itens"];
};

export function montarContextoIAPersonalizada(
  data: InteligenciaOperacional,
  nomeOperacao: string
): ContextoIAPersonalizada {
  return {
    nomeOperacao,
    periodoLabel: data.periodoLabel,
    nichos: data.nichos,
    visao: data.visaoGeral,
    comparativo: data.comparativo,
    rankingCidades: data.rankingCidades.slice(0, 20),
    rankingPontos: data.rankingPontos.slice(0, 30),
    furaFura: data.furaFura,
    cassino: data.cassino,
    ursinho: data.ursinho,
    diversao: data.diversao,
    bolinha: data.bolinha,
    consignado: data.consignado,
    pontosAtencao: data.pontosAtencao.slice(0, 12),
    estoqueAbaixoMinimo: data.estoque.itens.filter((i) => i.abaixoMinimo).slice(0, 10),
  };
}

function mapMaquinaCassino(m: NonNullable<ContextoIAPersonalizada["cassino"]>["rankingMaquinas"][0]) {
  return {
    nome: m.nome,
    tipo: m.tipo === "vending_ursinho" ? "urso_pelucia" : m.tipo === "cassino" ? "cassino" : m.tipo,
    numero: m.numeroMaquina,
    ponto: m.pontoNome,
    lucro: m.lucro,
    entrada: centesimosToReais(m.entrada),
    saida: centesimosToReais(m.saida),
    pct_pago: m.pctPago,
    leituras: m.leituras,
  };
}

/** Contexto compacto em JSON para o prompt (sem PII excessiva). */
export function serializarContextoParaPrompt(ctx: ContextoIAPersonalizada): string {
  const nichosAtivos: string[] = [];
  if (ctx.nichos.furaFura) nichosAtivos.push("fura_fura");
  if (ctx.nichos.cassino) nichosAtivos.push("maquinas_cassino_e_urso");
  if (ctx.nichos.ursinho) nichosAtivos.push("ursinho");
  if (ctx.nichos.diversao) nichosAtivos.push("diversao");
  if (ctx.nichos.bolinha) nichosAtivos.push("bolinha");
  if (ctx.nichos.consignado) nichosAtivos.push("consignado");

  const cassino = ctx.cassino;
  const maquinas = cassino?.rankingMaquinas ?? [];
  const maquinasCassino = maquinas.filter((m) => m.tipo === "cassino");
  const maquinasUrso = maquinas.filter((m) => m.tipo === "vending_ursinho");

  const payload = {
    operacao: ctx.nomeOperacao,
    periodo: ctx.periodoLabel,
    nichos_ativos: nichosAtivos,
    visao_geral: {
      entrada: ctx.visao.entrada,
      saida: ctx.visao.saida,
      comissao: ctx.visao.comissao,
      liquido_movimento: ctx.visao.liquidoMovimento,
      liquido_operacao: ctx.visao.liquidoOperacao,
      faturamento_bruto: ctx.visao.faturamentoBruto,
      lucro_liquido: ctx.visao.liquidoOperacao,
      margem_pct: ctx.visao.margemPct,
      total_furos_periodo: ctx.visao.totalFurosMes,
      a_receber: ctx.visao.aReceber,
      haver: ctx.visao.haver,
      movimentos: ctx.visao.movimentos,
      estoque_central_valor: ctx.visao.valorEstoqueCentral,
      brindes_nos_pontos_valor: ctx.visao.valorBrindesPontos,
      total_maquinas_cassino_urso: ctx.visao.totalMaquinasCassino,
      total_pontos_fura: ctx.visao.totalPontosFura,
    },
    comparativo_periodo_anterior: ctx.comparativo,
    faturamento_por_cidade: ctx.rankingCidades.map((c) => ({
      cidade: c.cidade,
      lucro: c.lucro,
      bruto: c.bruto || c.dinheiroOperacao,
      pontos: c.pontos,
      share_lucro_pct: c.shareLucroPct,
      margem_pct: c.margemPct,
    })),
    ranking_pontos_consolidado: {
      melhores: ctx.rankingPontos.filter((p) => p.lucro > 0).slice(0, 10).map((p) => ({
        nome: p.nome,
        cidade: p.cidade,
        lucro: p.lucro,
        bruto: p.bruto || p.dinheiroOperacao,
        custo_brindes: p.custoBrindes,
        movimentos: p.movimentos,
      })),
      piores: [...ctx.rankingPontos]
        .sort((a, b) => a.lucro - b.lucro)
        .slice(0, 10)
        .map((p) => ({
          nome: p.nome,
          cidade: p.cidade,
          lucro: p.lucro,
          bruto: p.bruto || p.dinheiroOperacao,
          custo_brindes: p.custoBrindes,
          movimentos: p.movimentos,
        })),
    },
    fura_fura: ctx.furaFura
      ? {
          caixa: ctx.furaFura.caixa,
          total_furos: ctx.furaFura.totalFuros,
          coletas: ctx.furaFura.coletas,
          ranking_kits_por_furos: ctx.furaFura.rankingKits.map((k) => ({
            kit: k.kitNome,
            total_furos: k.totalFuros,
            coletas: k.totalColetas,
            media_furos_por_coleta: k.mediaFurosPorColeta,
            total_brindes: k.totalBrindes,
            ratio_brindes_por_furo: k.ratioBrindesPorFuro,
          })),
          alertas_brinde_anormal: ctx.furaFura.alertasBrindeKit.map((a) => ({
            ponto: a.pontoNome,
            kit: a.kitNome,
            ratio_atual: a.ratioAtual,
            ratio_medio_kit: a.ratioMedioKit,
            desvio_pct: a.desvioPct,
          })),
          top_pontos_lucro: ctx.furaFura.rankingPontos.slice(0, 8).map((p) => ({
            nome: p.nome,
            lucro: p.lucro,
            coletas: p.movimentos,
            custo_brindes: p.custoBrindes,
          })),
          piores_pontos: [...ctx.furaFura.rankingPontos]
            .sort((a, b) => a.lucro - b.lucro)
            .slice(0, 5)
            .map((p) => ({ nome: p.nome, lucro: p.lucro })),
          brindes_mais_entregues: ctx.furaFura.rankingBrindes.slice(0, 8).map((b) => ({
            nome: b.nome,
            entregues: b.entregues,
            estoque_nos_pontos: b.estoquePontos,
          })),
          saude_pontos: ctx.furaFura.saudePontos.slice(0, 10).map((p) => ({
            nome: p.nome,
            classe: p.classe,
            lucro: p.lucroMes,
            visitas_coletas: p.visitas,
            indice_saude_pct: p.indice,
          })),
        }
      : null,
    cassino_e_urso: cassino
      ? {
          lucro: cassino.lucro,
          entrada_total: centesimosToReais(cassino.entrada),
          saida_total: centesimosToReais(cassino.saida),
          pct_pago_geral:
            cassino.entrada > 0
              ? Math.round((cassino.saida / cassino.entrada) * 1000) / 10
              : null,
          visitas_periodo: cassino.visitas,
          ranking_pontos_lucro: cassino.rankingPontos.slice(0, 8).map((p) => ({
            nome: p.nome,
            lucro: p.lucro,
            visitas: p.movimentos,
            entrada: p.bruto,
          })),
          piores_pontos: [...cassino.rankingPontos]
            .sort((a, b) => a.lucro - b.lucro)
            .slice(0, 5)
            .map((p) => ({ nome: p.nome, lucro: p.lucro })),
          maquinas_mais_lucro: maquinas.slice(0, 8).map(mapMaquinaCassino),
          maquinas_mais_entrada: [...maquinas]
            .sort((a, b) => b.entrada - a.entrada)
            .slice(0, 8)
            .map(mapMaquinaCassino),
          maquinas_mais_saida: [...maquinas]
            .sort((a, b) => b.saida - a.saida)
            .slice(0, 8)
            .map(mapMaquinaCassino),
          maquinas_cassino: maquinasCassino.slice(0, 8).map(mapMaquinaCassino),
          maquinas_urso_pelucia: maquinasUrso.slice(0, 8).map(mapMaquinaCassino),
          tipos_jogo: cassino.rankingJogos.slice(0, 8).map((j) => ({
            jogo: j.nome,
            maquinas: j.maquinas,
            entrada: centesimosToReais(j.entrada),
            saida: centesimosToReais(j.saida),
            pct_pago: j.pctPago,
            lucro: j.lucro,
            leituras: j.leituras,
          })),
          saude_pontos: cassino.saudePontos.slice(0, 12).map((p) => ({
            nome: p.nome,
            classe: p.classe,
            lucro: p.lucroMes,
            visitas: p.visitas,
            indice_saude_pct: p.indice,
            impulsos: p.impulsos,
            pressoes: p.pressoes,
          })),
        }
      : null,
    ursinho: ctx.ursinho
      ? {
          lucro_livre: ctx.ursinho.caixa.lucroLivre,
          bruto: ctx.ursinho.caixa.brutoMaquina,
          dinheiro_operacao: ctx.ursinho.caixa.dinheiroOperacao,
          reserva_brindes: ctx.ursinho.caixa.reservaBrindes,
          coletas: ctx.ursinho.coletas,
          total_maquinas: ctx.ursinho.totalMaquinas,
          top_pontos: ctx.ursinho.rankingPontos.slice(0, 8).map((p) => ({
            nome: p.nome,
            lucro: p.lucro,
            coletas: p.movimentos,
          })),
          top_maquinas: ctx.ursinho.rankingMaquinas.slice(0, 8).map((m) => ({
            nome: m.nome,
            ponto: m.pontoNome,
            lucro: m.lucro,
            leituras: m.leituras,
          })),
        }
      : null,
    diversao: ctx.diversao
      ? {
          lucro: ctx.diversao.caixa.lucroLivre,
          bruto: ctx.diversao.caixa.brutoMaquina,
          coletas: ctx.diversao.coletas,
          top_pontos: ctx.diversao.rankingPontos.slice(0, 8).map((p) => ({
            nome: p.nome,
            cidade: p.cidade,
            lucro: p.lucro,
          })),
        }
      : null,
    bolinha: ctx.bolinha
      ? {
          lucro: ctx.bolinha.caixa.lucroLivre,
          custo_brindes: ctx.bolinha.caixa.reservaBrindes,
          coletas: ctx.bolinha.coletas,
          top_pontos: ctx.bolinha.rankingPontos.slice(0, 8).map((p) => ({
            nome: p.nome,
            lucro: p.lucro,
          })),
        }
      : null,
    consignado: ctx.consignado
      ? {
          lucro: ctx.consignado.caixa.lucroLivre,
          custo_produtos: ctx.consignado.caixa.reservaBrindes,
          coletas: ctx.consignado.coletas,
          top_pontos: ctx.consignado.rankingPontos.slice(0, 8).map((p) => ({
            nome: p.nome,
            lucro: p.lucro,
          })),
          produtos_mais_vendidos: ctx.consignado.rankingBrindes.slice(0, 8).map((b) => ({
            nome: b.nome,
            entregues: b.entregues,
            custo: b.custoTotal,
          })),
        }
      : null,
    pontos_atencao: ctx.pontosAtencao.map((p) => ({
      nome: p.nome,
      motivos: p.motivos,
      lucro_periodo: p.lucroMes,
      classe: p.classe,
    })),
    estoque_baixo: ctx.estoqueAbaixoMinimo.map((e) => ({
      item: e.nome,
      qtd: e.quantidade,
      minimo: e.quantidadeMinima,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export const SYSTEM_PROMPT_IA_OPERACIONAL = `Você é consultor operacional de rotas com máquinas em bares e pontos comerciais.
A operação pode ter um ou mais nichos ativos: fura-fura, cassino, ursinho, diversão, bolinha e consignado.
Responda sempre em português brasileiro, de forma direta e acionável.

REGRAS POR NICHO (use apenas os que existirem no JSON):
• Fura-fura: métrica principal para kits = FUROS (jogadas), não brindes entregues. Kit fica no bar; prêmio é avulso. Ratio brindes/furo acima da média pode indicar furador mal montado.
• Cassino: compare entrada, saída, % pago e lucro por máquina e por ponto. Máquinas que mais jogam têm maior entrada no período.
• Urso/pelúcia: trate como máquinas tipo vending_ursinho no JSON — mesmo raciocínio de volume, saída e lucro por ponto.
• Rotas: use visitas/coletas do período e saúde dos pontos para sugerir frequência (ex.: mensal vs bimestral). Pontos fortes com muita visita/lucro podem precisar de passagem mais frequente; fracos ou com pouco movimento, menos.

FORMATO:
- Parágrafos curtos e listas numeradas para ações.
- Não invente dados — use só o JSON fornecido.
- Se faltar dado, diga o que registrar (visitas, coletas, leituras) para responder melhor.
- Não use markdown pesado (sem ###). Pode usar • para listas.`;
