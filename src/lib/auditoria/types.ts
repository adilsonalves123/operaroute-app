export type AuditoriaSeveridade =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type AuditoriaCategoria =
  | "sessao"
  | "equipamento"
  | "coleta"
  | "financeiro"
  | "ponto"
  | "equipe"
  | "estoque"
  | "chamado"
  | "sistema"
  | "anomalia";

export type AuditoriaEvento = {
  id: string;
  empresa_id: string;
  user_id: string | null;
  acao: string;
  tabela: string;
  registro_id: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
  severidade: AuditoriaSeveridade;
  categoria: AuditoriaCategoria;
  modulo: string | null;
  titulo: string | null;
  resumo: string | null;
  user_nome: string | null;
  user_email: string | null;
  user_role: string | null;
  ip: string | null;
  user_agent: string | null;
  meta: Record<string, unknown> | null;
};

export type AuditoriaSessao = {
  id: string;
  empresa_id: string;
  user_id: string;
  user_nome: string | null;
  user_email: string | null;
  user_role: string | null;
  iniciado_em: string;
  ultimo_ping_em: string;
  encerrado_em: string | null;
  ip: string | null;
  user_agent: string | null;
  dispositivo: string | null;
};

export const SEVERIDADE_LABEL: Record<AuditoriaSeveridade, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
  info: "Info",
};

export const CATEGORIA_LABEL: Record<AuditoriaCategoria, string> = {
  sessao: "Acesso",
  equipamento: "Equipamento",
  coleta: "Coleta",
  financeiro: "Financeiro",
  ponto: "Ponto",
  equipe: "Equipe",
  estoque: "Estoque",
  chamado: "Manutenção",
  sistema: "Sistema",
  anomalia: "Anomalia",
};
