export type VisitaPontoStatus = "rascunho" | "finalizada" | "cancelada";

export type VisitaPontoNicho =
  | "cassino"
  | "fura_fura"
  | "ursinho"
  | "diversao"
  | "bolinha"
  | "consignado";

export type VisitaPontoRow = {
  id: string;
  empresa_id: string;
  ponto_id: string;
  operador_id: string | null;
  status: VisitaPontoStatus;
  observacao: string | null;
  created_at: string;
  finalizada_em: string | null;
  subtotal_cobravel?: number | null;
  divida_anterior_total?: number | null;
  divida_recebida_inicio?: number | null;
  desconto?: number | null;
  valor_pix?: number | null;
  valor_dinheiro?: number | null;
  valor_pago?: number | null;
  total_cobrado?: number | null;
  restante?: number | null;
  forma_pagamento?: string | null;
};

export type VisitaPontoItemRow = {
  id: string;
  visita_ponto_id: string;
  empresa_id: string;
  nicho: VisitaPontoNicho;
  cassino_visita_id: string | null;
  coleta_id: string | null;
  grupo_id: string | null;
  ordem: number;
  created_at: string;
};

export type MaquinaResumoVisita = {
  id: string;
  nome: string;
  numeroMaquina?: string | null;
  valorCobravel: number;
  lucro: number;
  /** Entrada do período (legado / outros nichos). */
  entrada?: number;
  /** Contadores atuais da coleta cassino. */
  entradaAtual?: number;
  saidaAtual?: number;
};

export type NichoResumoVisita = {
  nicho: VisitaPontoNicho;
  label: string;
  totalCobravel: number;
  totalRecebido: number;
  totalLucro: number;
  totalBruto: number;
  custoBrindes: number;
  /** Comissão do ponto (cassino: valor_cliente). */
  valorCliente?: number;
  /** Parte da operação (cassino: valor_operacao). */
  valorOperacao?: number;
  maquinas: MaquinaResumoVisita[];
  itemIds: string[];
  href?: string;
};

export type CassinoNegativoResumo = {
  visitaId: string;
  valorOperacao: number;
  lucroReais: number;
  titulo: string;
  href: string;
};

export type VisitaPontoResumo = {
  visitaPontoId: string;
  pontoId: string;
  pontoNome: string;
  status: VisitaPontoStatus;
  createdAt: string;
  finalizadaEm: string | null;
  operadorId: string | null;
  nichos: NichoResumoVisita[];
  cassinoNegativo: CassinoNegativoResumo | null;
  subtotalCobravel: number;
  totalRecebido: number;
  totalLucro: number;
  itensConcluidos: number;
  dividaAnteriorSaldo?: number;
  dividaRecebidaInicio?: number;
  checkout?: {
    desconto: number;
    valorPix: number;
    valorDinheiro: number;
    valorPago: number;
    totalCobrado: number;
    restante: number;
  } | null;
};

export const NICHO_VISITA_LABELS: Record<VisitaPontoNicho, string> = {
  cassino: "Cassino",
  fura_fura: "Fura-fura",
  ursinho: "Ursinho",
  diversao: "Diversão",
  bolinha: "Bolinha",
  consignado: "Consignado",
};

export const NICHO_COLETA_PATH: Record<VisitaPontoNicho, string> = {
  cassino: "/coletas/nova/cassino",
  fura_fura: "/coletas/nova/fura-fura",
  ursinho: "/coletas/nova/ursinho",
  diversao: "/coletas/nova/diversao",
  bolinha: "/coletas/nova/bolinha",
  consignado: "/coletas/nova/consignado",
};
