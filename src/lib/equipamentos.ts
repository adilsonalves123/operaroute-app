import { formatContadorInput, parseContadorInput } from "@/lib/nichos/cassino/contadores";

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

/** Tipos do módulo Diversão — entrada única, sem brindes. */
export const DIVERSAO_EQUIPAMENTO_TIPOS: EquipamentoTipo[] = [
  "sinuca",
  "fliperama",
  "cadeira_massagem",
  "diversao",
];

export function isEquipamentoTipoDiversao(tipo: EquipamentoTipo | string): boolean {
  return (DIVERSAO_EQUIPAMENTO_TIPOS as string[]).includes(tipo);
}

/** Ursinho / bolinha / consignado — estoque de itens na máquina/expositor. */
export function isEquipamentoTipoComBrindes(tipo: EquipamentoTipo | string): boolean {
  return (
    tipo === "ursinho" ||
    tipo === "vending_ursinho" ||
    tipo === "bolinha" ||
    tipo === "consignado"
  );
}

/** Consignado — expositor com produtos do catálogo. */
export function isEquipamentoTipoConsignado(tipo: EquipamentoTipo | string): boolean {
  return tipo === "consignado";
}

export type AlocacaoBrindeItem = {
  source: "ponto" | "central";
  item_id: string;
  quantidade: number;
};

/** Alocação opcional após criar (ursinho/bolinha) — não vai no JSON da API */
export type AlocacaoBrindeCadastro =
  | { modo: "nenhum" }
  | { modo: "avulso"; itens: AlocacaoBrindeItem[] }
  | { modo: "kit"; kit_id: string };

export interface EquipamentoInput {
  id: string;
  /** Se já criou no servidor e só falta a foto — evita duplicar no retry */
  idCriado?: string;
  numero_maquina: string;
  numero_serie: string;
  nome: string;
  tipo: EquipamentoTipo | "";
  /** Cassino: leitura atual do painel (vira anterior na coleta) */
  numero_entrada: string;
  /** Cassino: leitura atual do painel (vira anterior na coleta) */
  numero_saida: string;
  entrada_atual: string;
  /** Bolinha: valor da jogada em R$ (ex.: "2" ou "2,00") */
  preco_jogada: string;
  observacao: string;
  /** Arquivo local antes do upload — não vai no JSON da API */
  fotoFile?: File | null;
  /** Preview blob: ou URL existente ao editar */
  fotoPreview?: string | null;
  /** Alocação opcional após criar (ursinho/bolinha) — não vai no JSON da API */
  alocacaoBrinde?: AlocacaoBrindeCadastro;
}

export const EQUIPAMENTO_TIPOS: {
  id: EquipamentoTipo;
  label: string;
  description: string;
  enabled: boolean;
}[] = [
  {
    id: "cassino",
    label: "Cassino",
    description: "Máquina de cassino",
    enabled: true,
  },
  {
    id: "fura_fura",
    label: "Fura Fura",
    description: "Máquina fura-fura",
    enabled: true,
  },
  {
    id: "ursinho",
    label: "Máquina de ursinho",
    description: "Máquina de pelúcia / ursinho",
    enabled: true,
  },
  {
    id: "bolinha",
    label: "Máquina de bolinha",
    description: "Bolinha / cápsula",
    enabled: true,
  },
  {
    id: "consignado",
    label: "Expositor",
    description: "Expositor no comércio",
    enabled: true,
  },
  {
    id: "sinuca",
    label: "Sinuca",
    description: "Diversão — sinuca",
    enabled: true,
  },
  {
    id: "fliperama",
    label: "Fliperama",
    description: "Diversão — fliperama",
    enabled: true,
  },
  {
    id: "cadeira_massagem",
    label: "Cadeira de massagem",
    description: "Diversão — cadeira de massagem",
    enabled: true,
  },
  {
    id: "diversao",
    label: "Diversão (outros)",
    description: "Outras máquinas de diversão",
    enabled: true,
  },
  {
    id: "vending_ursinho",
    label: "Vending (legado)",
    description: "Tipo legado — use Máquina de ursinho",
    enabled: false,
  },
];

/**
 * Tipos físicos de máquina/equipamento (cadastro no estoque ou ponto).
 * Produtos, brindes e itens do consignado ficam no estoque / produtos consignados.
 */
export const EQUIPAMENTO_TIPOS_MAQUINA: EquipamentoTipo[] = [
  "cassino",
  "fura_fura",
  "ursinho",
  "bolinha",
  "consignado",
  "sinuca",
  "fliperama",
  "cadeira_massagem",
  "diversao",
];

export function isEquipamentoTipoMaquina(tipo: EquipamentoTipo | string): boolean {
  return (EQUIPAMENTO_TIPOS_MAQUINA as string[]).includes(tipo);
}

export function createEmptyEquipamento(_index: number): EquipamentoInput {
  return {
    id: crypto.randomUUID(),
    numero_maquina: "",
    numero_serie: "",
    nome: "",
    tipo: "",
    numero_entrada: "",
    numero_saida: "",
    entrada_atual: "",
    preco_jogada: "",
    observacao: "",
    alocacaoBrinde: { modo: "nenhum" },
  };
}

export function parseLeituraContador(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return parseContadorInput(digits);
}

/**
 * Valida cadastro. `modoEstoque`: cadastrar no inventário (sem ponto) —
 * exige série + nome + tipo; nº no ponto só na alocação.
 */
export function validateEquipamento(
  eq: EquipamentoInput,
  opts?: { modoEstoque?: boolean }
): string | null {
  if (!eq.tipo) return "Selecione o tipo do equipamento";
  if (!eq.nome.trim()) return "Informe o nome do equipamento";
  if (!eq.numero_serie.trim()) return "Informe o número de série";

  if (!opts?.modoEstoque) {
    if (!eq.numero_maquina.trim()) return "Informe o nº no ponto";
  }

  if (eq.tipo === "cassino") {
    if (!opts?.modoEstoque) {
      if (!eq.numero_entrada.trim()) return "Informe a entrada atual";
      if (!eq.numero_saida.trim()) return "Informe a saída atual";
    }
  }

  if (eq.tipo === "bolinha") {
    const preco = Number(String(eq.preco_jogada).replace(",", "."));
    if (!eq.preco_jogada.trim() || !(preco > 0)) return "Informe o valor da jogada (ex.: 2,00)";
  }

  if (!opts?.modoEstoque) {
    if (eq.tipo === "ursinho" || eq.tipo === "vending_ursinho") {
      if (!eq.entrada_atual.trim()) return "Informe a entrada atual";
    }
    if (isEquipamentoTipoDiversao(eq.tipo)) {
      if (!eq.entrada_atual.trim()) return "Informe a entrada atual";
    }
  }

  return null;
}

export function getEquipamentoTipoLabel(tipo: EquipamentoTipo): string {
  return EQUIPAMENTO_TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}

export type EquipamentoGrupoId =
  | "maquinas_cassino"
  | "ursinho"
  | "vending_ursinho"
  | "fura_fura"
  | "diversao"
  | "bolinha"
  | "consignado";

export const EQUIPAMENTO_GRUPOS: {
  id: EquipamentoGrupoId;
  label: string;
  subtitle: string;
  tipos: EquipamentoTipo[];
}[] = [
  {
    id: "maquinas_cassino",
    label: "Cassino",
    subtitle: "Máquinas de cassino",
    tipos: ["cassino"],
  },
  {
    id: "ursinho",
    label: "Máquina de ursinho",
    subtitle: "Máquinas de pelúcia / ursinho",
    tipos: ["ursinho"],
  },
  {
    id: "vending_ursinho",
    label: "Vending (legado)",
    subtitle: "Tipo legado",
    tipos: ["vending_ursinho"],
  },
  {
    id: "fura_fura",
    label: "Fura Fura",
    subtitle: "Máquinas fura-fura",
    tipos: ["fura_fura"],
  },
  {
    id: "diversao",
    label: "Diversão",
    subtitle: "Sinuca, fliperama, cadeira de massagem e outros",
    tipos: DIVERSAO_EQUIPAMENTO_TIPOS,
  },
  {
    id: "bolinha",
    label: "Máquina de bolinha",
    subtitle: "Bolinha / cápsula",
    tipos: ["bolinha"],
  },
  {
    id: "consignado",
    label: "Expositor",
    subtitle: "Expositores no comércio",
    tipos: ["consignado"],
  },
];

export function groupEquipamentosPorModulo<T extends { tipo: EquipamentoTipo }>(
  equipamentos: T[]
): { grupo: (typeof EQUIPAMENTO_GRUPOS)[number]; items: T[] }[] {
  return EQUIPAMENTO_GRUPOS.map((grupo) => ({
    grupo,
    items: equipamentos.filter((eq) => grupo.tipos.includes(eq.tipo)),
  })).filter((entry) => entry.items.length > 0);
}

export function getEquipamentoDisplayNome(eq: {
  numero_maquina?: string | null;
  numero_serie?: string | null;
  nome: string;
}): string {
  const parts: string[] = [];
  const serie = eq.numero_serie?.trim();
  if (serie) parts.push(`Painel ${serie}`);
  const num = eq.numero_maquina?.trim();
  const nome = eq.nome.trim();
  if (num && nome) parts.push(`Nº ${num} · ${nome}`);
  else if (num) parts.push(`Nº ${num}`);
  else if (nome) parts.push(nome);
  return parts.join(" · ") || "Equipamento";
}

export function cassinoSemNumeroSerie(eq: {
  tipo: EquipamentoTipo | string;
  numero_serie?: string | null;
}): boolean {
  return (eq.tipo === "cassino" || eq.tipo === "ursinho") && !eq.numero_serie?.trim();
}

export function equipamentoCombinaBusca(
  eq: { nome: string; numero_maquina?: string | null; numero_serie?: string | null },
  termo: string
): boolean {
  const q = termo.trim().toLowerCase();
  if (!q) return true;
  return (
    eq.nome.toLowerCase().includes(q) ||
    (eq.numero_maquina?.toLowerCase().includes(q) ?? false) ||
    (eq.numero_serie?.toLowerCase().includes(q) ?? false)
  );
}

export { formatContadorInput };
