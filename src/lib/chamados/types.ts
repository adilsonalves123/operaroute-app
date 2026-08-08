export type ChamadoStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";
export type ChamadoPrioridade = "baixa" | "media" | "alta" | "urgente";
export type ChamadoEventoTipo =
  | "aberto"
  | "iniciado"
  | "comentario"
  | "concluido"
  | "cancelado";

export const CHAMADO_STATUS_LABEL: Record<ChamadoStatus, string> = {
  aberta: "Aberto",
  em_andamento: "Em atendimento",
  concluida: "Concluído",
  cancelada: "Cancelado",
};

export const CHAMADO_PRIORIDADE_LABEL: Record<ChamadoPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const CHAMADO_STATUS_VARIANT: Record<
  ChamadoStatus,
  "danger" | "warning" | "success" | "default"
> = {
  aberta: "danger",
  em_andamento: "warning",
  concluida: "success",
  cancelada: "default",
};

export const CHAMADOS_ABERTOS: ChamadoStatus[] = ["aberta", "em_andamento"];

export type ChamadoRow = {
  id: string;
  empresa_id: string;
  ponto_id: string;
  equipamento_id: string | null;
  criado_por_id: string | null;
  responsavel_id: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: ChamadoPrioridade;
  status: ChamadoStatus;
  observacao_resolucao: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  created_at: string;
  pontos?: { nome: string } | null;
  equipamentos?: { nome: string; tipo: string; numero_maquina: string | null } | null;
};

export type ChamadoEventoRow = {
  id: string;
  chamado_id: string;
  autor_id: string | null;
  autor_nome: string | null;
  tipo: ChamadoEventoTipo;
  texto: string;
  created_at: string;
};

export type ChamadoComEventos = ChamadoRow & {
  chamado_eventos?: ChamadoEventoRow[];
};

/** Resumo para badge no equipamento */
export type ChamadoResumoEquipamento = {
  id: string;
  equipamento_id: string | null;
  status: ChamadoStatus;
  titulo: string;
};
