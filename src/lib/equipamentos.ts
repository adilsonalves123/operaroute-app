import { formatContadorInput, parseContadorInput } from "@/lib/nichos/cassino/contadores";

export type EquipamentoTipo = "cassino" | "vending_ursinho" | "fura_fura";

export interface EquipamentoInput {
  id: string;
  numero_maquina: string;
  nome: string;
  tipo: EquipamentoTipo | "";
  /** Cassino: leitura atual do painel (vira anterior na coleta) */
  numero_entrada: string;
  /** Cassino: leitura atual do painel (vira anterior na coleta) */
  numero_saida: string;
  entrada_atual: string;
  observacao: string;
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
    description: "Entrada e saída no painel da máquina",
    enabled: true,
  },
  {
    id: "vending_ursinho",
    label: "Ursinho / Vending",
    description: "Somente entrada atual no visor",
    enabled: true,
  },
  {
    id: "fura_fura",
    label: "Fura Fura",
    description: "Contagem de furos na coleta — sem painel",
    enabled: true,
  },
];

export function createEmptyEquipamento(_index: number): EquipamentoInput {
  return {
    id: crypto.randomUUID(),
    numero_maquina: "",
    nome: "",
    tipo: "",
    numero_entrada: "",
    numero_saida: "",
    entrada_atual: "",
    observacao: "",
  };
}

export function parseLeituraContador(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return parseContadorInput(digits);
}

export function validateEquipamento(eq: EquipamentoInput): string | null {
  if (!eq.tipo) return "Selecione o nicho do equipamento";
  if (!eq.numero_maquina.trim()) return "Informe o número da máquina";
  if (!eq.nome.trim()) return "Informe o nome da máquina";

  if (eq.tipo === "cassino") {
    if (!eq.numero_entrada.trim()) return "Informe a entrada atual";
    if (!eq.numero_saida.trim()) return "Informe a saída atual";
  }

  if (eq.tipo === "vending_ursinho") {
    if (!eq.entrada_atual.trim()) return "Informe a entrada atual";
  }

  return null;
}

export function getEquipamentoTipoLabel(tipo: EquipamentoTipo): string {
  return EQUIPAMENTO_TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}

export type EquipamentoGrupoId = "maquinas_cassino" | "fura_fura";

export const EQUIPAMENTO_GRUPOS: {
  id: EquipamentoGrupoId;
  label: string;
  subtitle: string;
  tipos: EquipamentoTipo[];
}[] = [
  {
    id: "maquinas_cassino",
    label: "Máquinas / Cassino",
    subtitle: "Leitura de entrada e saída no painel",
    tipos: ["cassino", "vending_ursinho"],
  },
  {
    id: "fura_fura",
    label: "Fura Fura",
    subtitle: "Coleta por contagem de furos",
    tipos: ["fura_fura"],
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
  nome: string;
}): string {
  const num = eq.numero_maquina?.trim();
  const nome = eq.nome.trim();
  if (num && nome) return `Nº ${num} · ${nome}`;
  return num ? `Nº ${num}` : nome;
}

export { formatContadorInput };
