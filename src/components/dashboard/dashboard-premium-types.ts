import type { DashboardConsolidadoData } from "@/lib/dashboard-consolidado";
import type { DashboardNichoId } from "@/lib/dashboard-nichos-ativos";
import type { PulsoOperacao } from "@/lib/dashboard-pulso";
import type { CartelaPontos } from "@/lib/dashboard-cartela-pontos";
import type { SaudePontosResumo } from "@/lib/dashboard-saude-pontos";

export type DashboardQuickAction = {
  label: string;
  href: string;
  icon?: string;
};

export type DashboardRankItem = {
  pontoId: string;
  nome: string;
  valor: number;
};

export type DashboardKpi = {
  label: string;
  value: number;
  isCurrency?: boolean;
  warning?: boolean;
};

export type DashboardNichoLinha = {
  id: DashboardNichoId;
  label: string;
  entrada: number;
  saida: number;
  /** Resultado do movimento (entrada − saída). */
  liquidoMovimento: number;
  /** Resultado da operação (competência): conta na coleta, mesmo sem pagamento. */
  liquidoOperacao: number;
  /** @deprecated use liquidoOperacao */
  lucro: number;
  /** @deprecated use entrada */
  bruto: number;
  aReceber: number;
  haver: number;
  movimentos: number;
  shareLucroPct: number | null;
};

export type DashboardPremiumData = {
  greeting: string;
  operacaoNome: string;
  periodLabel: string;
  nichoLabel: string;
  movimentosLabel: string | null;
  isMulti: boolean;
  /** @deprecated use liquidoOperacao */
  lucro: number;
  /** Entrada total das máquinas no período. */
  entrada: number;
  /** Saída total das máquinas no período. */
  saida: number;
  /** Resultado do movimento (entrada − saída). */
  liquidoMovimento: number;
  /** Lucro líquido = resultado da operação (competência), não só o pago. */
  liquidoOperacao: number;
  /** @deprecated use entrada */
  bruto: number;
  aReceber: number;
  haver: number;
  margemPct: number | null;
  sparkline: number[];
  chamadosAbertos: number;
  pontosSemColeta: number;
  kpis: DashboardKpi[];
  nichos: DashboardNichoLinha[];
  melhores: DashboardRankItem[];
  piores: DashboardRankItem[];
  saude: SaudePontosResumo;
  pulso: PulsoOperacao;
  cartela: CartelaPontos;
  quickActions: DashboardQuickAction[];
  comparativo: {
    lucroAtual: number;
    lucroAnterior: number;
    coletasAtual: number;
    coletasAnterior: number;
  } | null;
  /** Consolidado bruto (multi) — opcional, para detalhe */
  consolidado: DashboardConsolidadoData | null;
  /** Comissão do ajudante (% da Equipe sobre o livre da coleta). Só exibição. */
  comissaoStaff: {
    total: number;
    totalVales: number;
    totalAPagar: number;
    /** True quando o card é a comissão de quem está logado. */
    propria: boolean;
    linhas: {
      nome: string;
      percentual: number;
      valor: number;
      vales: number;
      aPagar: number;
    }[];
  } | null;
  /** Upgrade sugerido com base na pesquisa de onboarding */
  pesquisaUpgrade: {
    mensagem: string;
    href: string;
    proximoPlanoNome: string | null;
    nichosBloqueados: string[];
  } | null;
};
