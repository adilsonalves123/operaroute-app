export type UniversidadeModulo =
  | "comecar"
  | "pontos"
  | "coletas"
  | "financeiro"
  | "equipe"
  | "rotas"
  | "planos"
  | "nichos";

export type UniversidadeAula = {
  id: string;
  titulo: string;
  descricao: string;
  modulo: UniversidadeModulo;
  /** Ex.: "8 min" */
  duracao: string;
  /**
   * ID do YouTube (só o código, ex.: dQw4w9WgXcQ).
   * null = aula planejada, ainda sem vídeo.
   */
  youtubeId: string | null;
};

export const UNIVERSIDADE_MODULOS: {
  id: UniversidadeModulo | "todos";
  label: string;
}[] = [
  { id: "todos", label: "Todos" },
  { id: "comecar", label: "Começar" },
  { id: "pontos", label: "Pontos" },
  { id: "coletas", label: "Coletas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "equipe", label: "Equipe" },
  { id: "rotas", label: "Rotas" },
  { id: "planos", label: "Planos" },
  { id: "nichos", label: "Nichos" },
];

export const UNIVERSIDADE_AULAS: UniversidadeAula[] = [
  {
    id: "tour-5min",
    titulo: "Tour rápido do OperaRoute",
    descricao: "Dashboard, menu e o fluxo do dia a dia em poucos minutos.",
    modulo: "comecar",
    duracao: "6 min",
    youtubeId: null,
  },
  {
    id: "primeiro-acesso",
    titulo: "Primeiro acesso e configuração",
    descricao: "Pesquisa, nichos, trial de 7 dias e o que ajustar nas configurações.",
    modulo: "comecar",
    duracao: "8 min",
    youtubeId: null,
  },
  {
    id: "cadastrar-ponto",
    titulo: "Cadastrar pontos e clientes",
    descricao: "Criar ponto, endereço, contato e vincular o nicho certo.",
    modulo: "pontos",
    duracao: "10 min",
    youtubeId: null,
  },
  {
    id: "maquinas",
    titulo: "Máquinas e equipamentos",
    descricao: "Alocar máquina no ponto, identificação e transferência.",
    modulo: "pontos",
    duracao: "9 min",
    youtubeId: null,
  },
  {
    id: "coleta-geral",
    titulo: "Como fazer uma coleta",
    descricao: "Do ponto até o resumo: valores, fotos e o que vai para o financeiro.",
    modulo: "coletas",
    duracao: "12 min",
    youtubeId: null,
  },
  {
    id: "coleta-fura",
    titulo: "Coleta Fura Fura",
    descricao: "Passo a passo específico do módulo Fura Fura.",
    modulo: "nichos",
    duracao: "8 min",
    youtubeId: null,
  },
  {
    id: "coleta-diversao",
    titulo: "Coleta Diversão",
    descricao: "Passo a passo do módulo Diversão.",
    modulo: "nichos",
    duracao: "8 min",
    youtubeId: null,
  },
  {
    id: "coleta-cassino",
    titulo: "Visita e cassino",
    descricao: "Operação de máquinas / cassino, comissão e abatimentos.",
    modulo: "nichos",
    duracao: "10 min",
    youtubeId: null,
  },
  {
    id: "financeiro-basico",
    titulo: "Entendendo o financeiro",
    descricao: "A receber, haver, lucro e como ler o mês.",
    modulo: "financeiro",
    duracao: "11 min",
    youtubeId: null,
  },
  {
    id: "baixas",
    titulo: "Baixas e recebimentos",
    descricao: "Registrar pagamento, PIX/dinheiro e limpar pendências.",
    modulo: "financeiro",
    duracao: "7 min",
    youtubeId: null,
  },
  {
    id: "equipe",
    titulo: "Equipe e permissões",
    descricao: "Convidar operador/gerente, login e o que cada um pode ver.",
    modulo: "equipe",
    duracao: "9 min",
    youtubeId: null,
  },
  {
    id: "rotas",
    titulo: "Montar e executar rotas",
    descricao: "Montar o percurso do dia, atribuir e acompanhar no app.",
    modulo: "rotas",
    duracao: "8 min",
    youtubeId: null,
  },
  {
    id: "planos-nichos",
    titulo: "Planos, pontos e nichos",
    descricao: "Régua de capacidade, limite de nichos e quando fazer upgrade.",
    modulo: "planos",
    duracao: "7 min",
    youtubeId: null,
  },
];

export function labelModuloUniversidade(modulo: UniversidadeModulo): string {
  return UNIVERSIDADE_MODULOS.find((m) => m.id === modulo)?.label ?? modulo;
}
