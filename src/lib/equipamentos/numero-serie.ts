export function normalizarNumeroSerie(raw: string): string {
  return raw.trim().toLowerCase();
}

export function numeroSerieValido(raw: string): boolean {
  return raw.trim().length >= 2;
}

export type EquipamentoSerieResumo = {
  id: string;
  ponto_id: string | null;
  nome: string;
  numero_maquina: string | null;
  numero_serie: string | null;
  tipo: string;
  status: string;
  numero_entrada: number | null;
  numero_saida: number | null;
  foto_url: string | null;
  created_at: string;
  ponto_nome: string | null;
  /** true quando ponto_id é null (estoque central). */
  em_estoque: boolean;
};

export type ColetaSerieHistorico = {
  id: string;
  visita_id: string | null;
  created_at: string;
  entrada_anterior: number | null;
  saida_anterior: number | null;
  entrada_atual: number | null;
  saida_atual: number | null;
  entrada_periodo: number | null;
  saida_periodo: number | null;
  lucro_centavos: number | null;
  foto_url: string | null;
  ponto_id: string | null;
  ponto_nome: string | null;
  equipamento_nome: string | null;
};

export type BuscaNumeroSerieResult = {
  serie: string;
  encontrado: boolean;
  equipamento_ativo: EquipamentoSerieResumo | null;
  equipamentos_historico: EquipamentoSerieResumo[];
  coletas: ColetaSerieHistorico[];
  foto_referencia: string | null;
  aviso: string | null;
};
