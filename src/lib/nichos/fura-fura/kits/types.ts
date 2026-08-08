export type FuraKitReposicaoItem = {
  id?: string;
  kit_id?: string;
  estoque_item_id: string | null;
  nome: string;
  quantidade: number;
  custo_unitario: number;
};

export type FuraKitPremio = {
  id?: string;
  kit_id?: string;
  estoque_item_id: string | null;
  nome: string;
  custo_unitario: number;
  ordem: number;
};

export type FuraKit = {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  foto_url?: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
  reposicao_itens?: FuraKitReposicaoItem[];
  premios?: FuraKitPremio[];
};

export type RankingKitFuros = {
  kitId: string;
  kitNome: string;
  totalFuros: number;
  totalColetas: number;
  mediaFurosPorColeta: number;
  totalBrindes: number;
  ratioBrindesPorFuro: number | null;
};

export type PontoKitAlertaBrinde = {
  pontoId: string;
  pontoNome: string;
  kitId: string | null;
  kitNome: string | null;
  ratioAtual: number;
  ratioMedioKit: number;
  desvioPct: number;
};
