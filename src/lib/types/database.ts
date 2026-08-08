export type Nicho =
  | "fura_fura"
  | "maquinas_cassino"
  | "ursinho"
  | "vending_ursinho"
  | "diversao"
  | "bolinha"
  | "consignado"
  | "outros";
export type FaixaPontos = "1-10" | "11-50" | "51-100" | "100+";
export type Plano = "start" | "pro" | "elite";
export type UserRole = "admin" | "gerente" | "operador" | "visualizador";
export type PontoStatus = "ativo" | "pausado" | "retirado" | "inadimplente";
export type PendenciaPrioridade = "baixa" | "media" | "alta" | "urgente";
export type PendenciaStatus = "aberta" | "em_andamento" | "resolvida";
export type FinanceiroTipo = "entrada" | "saida";
export type FormaPagamento = "dinheiro" | "pix" | "misto";

export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  whatsapp: string | null;
  email: string;
  onboarding_completo: boolean;
  nicho: Nicho | null;
  nome_operacao: string | null;
  empresa_id: string | null;
  plano: Plano;
  trial_inicio: string | null;
  trial_fim: string | null;
  assinatura_ativa: boolean;
  created_at: string;
}

export interface Empresa {
  id: string;
  owner_id: string;
  nome_operacao: string;
  nicho: Nicho;
  quantidade_pontos: string;
  possui_funcionarios: boolean;
  objetivo_principal: string;
  plano: Plano;
  status: string;
  limite_pontos: number;
  limite_usuarios: number;
  /** Dias para manter fotos/relatórios. 0 = só exclusão manual. Padrão 90. */
  retencao_midia_dias?: number | null;
  /** Pesquisa rápida do onboarding (interesse em nichos, pontos, funcionários). */
  pesquisa_onboarding?: {
    quantidade_pontos?: string;
    nichos_interesse?: Nicho[];
    possui_funcionarios?: boolean;
    respondido_em?: string;
  } | null;
  created_at: string;
  nichos_ativos?: Nicho[];
  assinatura_vence_em?: string | null;
  ciclo_cobranca?: "mensal" | "anual" | null;
  /** Chave Pix da operação — cobrança via WhatsApp. */
  chave_pix?: string | null;
}

export interface EmpresaNicho {
  id: string;
  empresa_id: string;
  nicho: Nicho;
  ativo: boolean;
  created_at: string;
  /** Preenchido quando o cliente confirma o nicho; troca só via suporte. */
  confirmado_em?: string | null;
}

export type EquipamentoTipo =
  | "cassino"
  | "ursinho"
  | "vending_ursinho"
  | "fura_fura"
  | "sinuca"
  | "fliperama"
  | "cadeira_massagem"
  | "diversao"
  | "bolinha"
  | "consignado";

export interface Equipamento {
  id: string;
  empresa_id: string;
  /** NULL = estoque central (não alocado) */
  ponto_id: string | null;
  nome: string;
  numero_maquina: string | null;
  numero_serie: string | null;
  tipo: EquipamentoTipo;
  numero_entrada: number | null;
  numero_saida: number | null;
  entrada_atual: number | null;
  /** Bolinha: valor da jogada em reais (ex.: 2.00) */
  preco_jogada?: number | null;
  status: string;
  observacao: string | null;
  foto_url: string | null;
  estoque_brindes?: { item_id?: string; nome: string; quantidade: number; custo_unitario?: number }[] | null;
  created_at: string;
}

export interface Ponto {
  id: string;
  empresa_id: string;
  nome: string;
  responsavel: string | null;
  whatsapp: string | null;
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  tipo_ponto: string | null;
  status: PontoStatus;
  comissao_percentual: number;
  /** Comissão % por nicho: { maquinas_cassino, fura_fura, consignado, ... } */
  comissao_por_nicho?: Record<string, number> | null;
  operador_id: string | null;
  observacoes: string | null;
  abater_automatico: boolean;
  foto_url: string | null;
  ultima_coleta: string | null;
  created_at: string;
  status_alterado_em?: string | null;
  preco_furo?: number | null;
  furos_estoque?: number | null;
  furos_minimo?: number | null;
  estoque_brindes?: { item_id?: string; nome: string; quantidade: number; custo_unitario?: number }[] | null;
  kit_ativo_id?: string | null;
  kit_instalado_em?: string | null;
  /** Consignado: 'percentual' (usa comissao_por_nicho.consignado) ou 'tabela' (R$ fixo por produto) */
  consignado_modo_comissao?: "percentual" | "tabela" | null;
  equipamentos?: Equipamento[];
}

export interface ProdutoConsignado {
  id: string;
  empresa_id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  foto_url: string | null;
  custo_unitario: number | null;
  preco_venda: number | null;
  comissao_fixa: number | null;
  quantidade: number | null;
  quantidade_minima: number | null;
  fornecedor: string | null;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
}

export interface FuraKit {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export interface FuraKitReposicaoItem {
  id: string;
  kit_id: string;
  estoque_item_id: string | null;
  nome: string;
  quantidade: number;
  custo_unitario: number;
}

export interface FuraKitPremio {
  id: string;
  kit_id: string;
  estoque_item_id: string | null;
  nome: string;
  custo_unitario: number;
  ordem: number;
}

export interface Coleta {
  id: string;
  empresa_id: string;
  ponto_id: string;
  visita_id: string | null;
  equipamento_id: string | null;
  operador_id: string | null;
  valor_bruto: number;
  comissao_percentual: number;
  valor_comissao: number;
  valor_liquido: number;
  valor_pago_ponto: number | null;
  quantidade_furos: number | null;
  brindes_repostos: number | null;
  brindes_restantes: number | null;
  entrada: number | null;
  saida: number | null;
  entrada_anterior: number | null;
  saida_anterior: number | null;
  entrada_atual: number | null;
  saida_atual: number | null;
  entrada_periodo: number | null;
  saida_periodo: number | null;
  lucro_centavos: number | null;
  valor_cliente: number | null;
  valor_operacao: number | null;
  forma_pagamento: FormaPagamento;
  foto_url: string | null;
  observacao: string | null;
  nicho_modulo?: string | null;
  preco_furo?: number | null;
  desconto?: number | null;
  valor_a_receber?: number | null;
  valor_pago_recebido?: number | null;
  valor_pix?: number | null;
  valor_dinheiro?: number | null;
  custo_brindes?: number | null;
  lucro_real?: number | null;
  relatorio_enviado?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  brindes_entregues?: BrindeEntregueColeta[] | null;
  kit_id?: string | null;
  kit_nome?: string | null;
  created_at: string;
  pontos?: Ponto;
}

export type BrindeEntregueColeta = {
  item_id?: string;
  nome: string;
  quantidade: number;
  custo_unitario: number;
};

export interface Visita {
  id: string;
  empresa_id: string;
  ponto_id: string;
  operador_id: string | null;
  total_entrada_periodo: number;
  total_saida_periodo: number;
  total_lucro_centavos: number;
  debito_abatido: number;
  desconto: number;
  valor_cliente: number;
  valor_operacao: number;
  desconto_recebimento: number;
  valor_operacao_efetivo: number;
  valor_pago: number;
  valor_pix: number;
  valor_dinheiro: number;
  adiantamento_pix?: number | null;
  adiantamento_dinheiro?: number | null;
  adiantamento_do_caixa?: boolean | null;
  adiantamento_pix_do_caixa?: boolean | null;
  adiantamento_dinheiro_do_caixa?: boolean | null;
  recebimento_pix_do_caixa?: boolean | null;
  recebimento_dinheiro_do_caixa?: boolean | null;
  restante: number;
  forma_pagamento: FormaPagamento;
  saldo_negativo: boolean;
  latitude: number | null;
  longitude: number | null;
  observacao: string | null;
  relatorio_url: string | null;
  created_at: string;
}

export interface RelatorioColeta {
  id: string;
  empresa_id: string;
  visita_id: string | null;
  ponto_id: string | null;
  foto_url: string;
  previa: boolean;
  created_at: string;
}

export interface Financeiro {
  id: string;
  empresa_id: string;
  tipo: FinanceiroTipo;
  categoria: string;
  valor: number;
  descricao: string | null;
  forma_pagamento: FormaPagamento | null;
  ponto_id: string | null;
  coleta_id: string | null;
  visita_id: string | null;
  operador_id: string | null;
  data: string;
  created_at: string;
}

export interface Pendencia {
  id: string;
  empresa_id: string;
  ponto_id: string | null;
  responsavel_id: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  valor: number | null;
  prioridade: PendenciaPrioridade;
  status: PendenciaStatus;
  data_limite: string | null;
  visita_id: string | null;
  coleta_id: string | null;
  resolvido_em: string | null;
  created_at: string;
  pontos?: Ponto;
}

export interface EstoqueItem {
  id: string;
  empresa_id: string;
  nome_item: string;
  descricao: string | null;
  categoria: string;
  custo_unitario: number;
  quantidade: number;
  quantidade_minima: number;
  foto_url: string | null;
  fornecedor: string | null;
  observacao: string | null;
  created_at: string;
}

export interface EquipeMember {
  id: string;
  empresa_id: string;
  user_id: string | null;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  role: UserRole;
  comissao_percentual: number;
  status: string;
  permissoes?: Record<string, unknown> | null;
  created_at: string;
}

export interface Rota {
  id: string;
  empresa_id: string;
  nome: string;
  operador_id: string | null;
  cidade: string | null;
  bairro: string | null;
  status: string;
  created_at: string;
}
