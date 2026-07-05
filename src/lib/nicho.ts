import type { Nicho } from "./types/database";

export interface NichoConfig {
  id: Nicho;
  label: string;
  description: string;
  dashboard: {
    stats: { key: string; label: string; color: "blue" | "green" | "red" | "orange" | "purple" }[];
    quickActions: { label: string; href: string; icon: string }[];
  };
  labels: {
    ponto: string;
    coleta: string;
    coletaNova: string;
  };
}

export const NICHOS: Record<Nicho, NichoConfig> = {
  fura_fura: {
    id: "fura_fura",
    label: "Fura Fura",
    description: "Operação de máquinas de brindes e fura-fura",
    dashboard: {
      stats: [
        { key: "total_mes", label: "Total arrecadado no mês", color: "blue" },
        { key: "lucro_estimado", label: "Lucro estimado", color: "green" },
        { key: "pontos_ativos", label: "Pontos ativos", color: "blue" },
        { key: "pontos_pendentes", label: "Pontos pendentes", color: "red" },
        { key: "coletas_realizadas", label: "Coletas realizadas", color: "orange" },
        { key: "brindes_estoque", label: "Brindes em estoque", color: "purple" },
      ],
      quickActions: [
        { label: "Nova coleta", href: "/coletas/nova/fura-fura", icon: "Package" },
        { label: "Pendências", href: "/coletas/pendentes", icon: "AlertTriangle" },
        { label: "Novo ponto", href: "/pontos/novo", icon: "MapPin" },
      ],
    },
    labels: {
      ponto: "Ponto",
      coleta: "Coleta",
      coletaNova: "Nova coleta",
    },
  },
  maquinas_cassino: {
    id: "maquinas_cassino",
    label: "Máquinas / Cassino",
    description: "Operação de máquinas e cassinos",
    dashboard: {
      stats: [
        { key: "entrada_total", label: "Entrada total", color: "green" },
        { key: "saida_total", label: "Saída total", color: "red" },
        { key: "saldo_liquido", label: "Saldo líquido", color: "blue" },
        { key: "maquinas_ativas", label: "Máquinas ativas", color: "blue" },
        { key: "clientes_ativos", label: "Clientes/pontos ativos", color: "orange" },
        { key: "pendencias", label: "Pendências", color: "red" },
        { key: "coletas_realizadas", label: "Coletas realizadas", color: "purple" },
      ],
      quickActions: [
        { label: "Nova leitura", href: "/coletas/nova", icon: "Activity" },
        { label: "Novo ponto", href: "/pontos/novo", icon: "MapPin" },
        { label: "Financeiro", href: "/financeiro", icon: "Wallet" },
      ],
    },
    labels: {
      ponto: "Cliente/Ponto",
      coleta: "Leitura",
      coletaNova: "Nova leitura",
    },
  },
  outros: {
    id: "outros",
    label: "Outros",
    description: "Outros negócios com pontos físicos",
    dashboard: {
      stats: [
        { key: "receita_mes", label: "Receita do mês", color: "green" },
        { key: "clientes_ativos", label: "Clientes ativos", color: "blue" },
        { key: "visitas", label: "Coletas/visitas", color: "orange" },
        { key: "pendencias", label: "Pendências", color: "red" },
        { key: "tarefas_abertas", label: "Tarefas abertas", color: "purple" },
      ],
      quickActions: [
        { label: "Nova visita", href: "/coletas/nova", icon: "ClipboardCheck" },
        { label: "Novo cliente", href: "/pontos/novo", icon: "UserPlus" },
        { label: "Relatórios", href: "/relatorios", icon: "BarChart3" },
      ],
    },
    labels: {
      ponto: "Cliente",
      coleta: "Visita",
      coletaNova: "Nova visita",
    },
  },
};

export function getNichoConfig(nicho: Nicho | null | undefined): NichoConfig {
  return NICHOS[nicho ?? "outros"];
}
