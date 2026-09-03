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
        { key: "a_receber_pendente", label: "A receber (coletas)", color: "red" },
        { key: "haver_ponto", label: "Haver dos pontos", color: "blue" },
        { key: "coletas_realizadas", label: "Coletas realizadas", color: "orange" },
        { key: "pontos_ativos", label: "Pontos ativos", color: "blue" },
        { key: "pontos_pendentes", label: "Pontos pendentes", color: "red" },
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
    description: "Operação de máquinas com entrada e saída no painel",
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
  vending_ursinho: {
    id: "vending_ursinho",
    label: "Vending",
    description: "Máquinas de entrada no visor sem fluxo de brindes do ursinho",
    dashboard: {
      stats: [
        { key: "entrada_total", label: "Entrada total", color: "green" },
        { key: "saldo_liquido", label: "Arrecadação líquida", color: "blue" },
        { key: "maquinas_ativas", label: "Máquinas ativas", color: "blue" },
        { key: "clientes_ativos", label: "Pontos ativos", color: "orange" },
        { key: "pendencias", label: "Pendências", color: "red" },
        { key: "coletas_realizadas", label: "Leituras realizadas", color: "purple" },
      ],
      quickActions: [
        { label: "Nova leitura", href: "/coletas/nova", icon: "Activity" },
        { label: "Novo ponto", href: "/pontos/novo", icon: "MapPin" },
        { label: "Financeiro", href: "/financeiro", icon: "Wallet" },
      ],
    },
    labels: {
      ponto: "Ponto",
      coleta: "Leitura",
      coletaNova: "Nova leitura",
    },
  },
  ursinho: {
    id: "ursinho",
    label: "Máquina de Ursinho",
    description: "Máquinas de pelúcia com leitura por entrada e controle de brindes",
    dashboard: {
      stats: [
        { key: "entrada_total", label: "Entrada no período", color: "green" },
        { key: "lucro_estimado", label: "Lucro real", color: "green" },
        { key: "custo_brindes", label: "Custo dos brindes", color: "red" },
        { key: "maquinas_ativas", label: "Máquinas ativas", color: "blue" },
        { key: "coletas_realizadas", label: "Coletas realizadas", color: "purple" },
        { key: "pendencias", label: "Pendências", color: "red" },
      ],
      quickActions: [
        { label: "Nova coleta", href: "/coletas/nova/ursinho", icon: "Activity" },
        { label: "Novo ponto", href: "/pontos/novo", icon: "MapPin" },
        { label: "Financeiro", href: "/financeiro", icon: "Wallet" },
      ],
    },
    labels: {
      ponto: "Ponto",
      coleta: "Coleta",
      coletaNova: "Nova coleta",
    },
  },
  diversao: {
    id: "diversao",
    label: "Diversão",
    description: "Sinuca, fliperama, cadeira de massagem e outras máquinas de entrada única",
    dashboard: {
      stats: [
        { key: "entrada_total", label: "Entrada no período", color: "green" },
        { key: "lucro_estimado", label: "Lucro real", color: "green" },
        { key: "maquinas_ativas", label: "Máquinas ativas", color: "blue" },
        { key: "coletas_realizadas", label: "Coletas realizadas", color: "purple" },
        { key: "pendencias", label: "Pendências", color: "red" },
      ],
      quickActions: [
        { label: "Nova coleta", href: "/coletas/nova/diversao", icon: "Activity" },
        { label: "Novo ponto", href: "/pontos/novo", icon: "MapPin" },
        { label: "Financeiro", href: "/financeiro", icon: "Wallet" },
      ],
    },
    labels: {
      ponto: "Ponto",
      coleta: "Coleta",
      coletaNova: "Nova coleta",
    },
  },
  bolinha: {
    id: "bolinha",
    label: "Bolinha / Cápsula",
    description: "Máquinas de bolinha e cápsula com entrada e controle de estoque",
    dashboard: {
      stats: [
        { key: "entrada_total", label: "Entrada no período", color: "green" },
        { key: "lucro_estimado", label: "Lucro real", color: "green" },
        { key: "custo_brindes", label: "Custo das cápsulas", color: "red" },
        { key: "maquinas_ativas", label: "Máquinas ativas", color: "blue" },
        { key: "coletas_realizadas", label: "Coletas realizadas", color: "purple" },
        { key: "pendencias", label: "Pendências", color: "red" },
      ],
      quickActions: [
        { label: "Nova coleta", href: "/coletas/nova/bolinha", icon: "Activity" },
        { label: "Novo ponto", href: "/pontos/novo", icon: "MapPin" },
        { label: "Financeiro", href: "/financeiro", icon: "Wallet" },
      ],
    },
    labels: {
      ponto: "Ponto",
      coleta: "Coleta",
      coletaNova: "Nova coleta",
    },
  },
  consignado: {
    id: "consignado",
    label: "Consignado",
    description: "Venda consignada em comércios com expositores e baixa por sobra",
    dashboard: {
      stats: [
        { key: "total_mes", label: "Vendido no mês", color: "green" },
        { key: "lucro_estimado", label: "Lucro real", color: "green" },
        { key: "custo_brindes", label: "Custo dos produtos", color: "red" },
        { key: "a_receber_pendente", label: "A receber (coletas)", color: "red" },
        { key: "maquinas_ativas", label: "Expositores ativos", color: "blue" },
        { key: "coletas_realizadas", label: "Recolhas realizadas", color: "purple" },
        { key: "pendencias", label: "Pendências", color: "red" },
      ],
      quickActions: [
        { label: "Novo recolhe", href: "/coletas/nova/consignado", icon: "Package" },
        { label: "Novo ponto", href: "/pontos/novo", icon: "MapPin" },
        { label: "Financeiro", href: "/financeiro", icon: "Wallet" },
      ],
    },
    labels: {
      ponto: "Comércio",
      coleta: "Recolhe",
      coletaNova: "Novo recolhe",
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

/** Cards visuais na página do ponto — troque coverImage em public/nichos/ */
export type NichoCardVisual = {
  id: Nicho;
  coverImage: string;
  cardDescription: string;
  accent: {
    border: string;
    ring: string;
    iconBg: string;
    iconText: string;
    checkBg: string;
  };
};

export const NICHO_CARD_VISUAL: Record<Nicho, NichoCardVisual> = {
  fura_fura: {
    id: "fura_fura",
    coverImage: "/nichos/fura-fura.png",
    cardDescription:
      "Operações com máquinas fura-fura em pontos comerciais, com controle de prêmios e arrecadações.",
    accent: {
      border: "border-green-500",
      ring: "ring-green-500/30",
      iconBg: "bg-green-500/15",
      iconText: "text-green-400",
      checkBg: "bg-green-500",
    },
  },
  maquinas_cassino: {
    id: "maquinas_cassino",
    coverImage: "/nichos/cassino.webp",
    cardDescription:
      "Operações com máquinas de caça-níqueis e slots — leitura de entrada e saída no painel.",
    accent: {
      border: "border-emerald-500",
      ring: "ring-emerald-500/30",
      iconBg: "bg-emerald-500/15",
      iconText: "text-emerald-400",
      checkBg: "bg-emerald-500",
    },
  },
  vending_ursinho: {
    id: "vending_ursinho",
    coverImage: "/nichos/ursinho.webp",
    cardDescription:
      "Máquinas vending com leitura só pela entrada do visor, sem fluxo de brindes.",
    accent: {
      border: "border-fuchsia-500",
      ring: "ring-fuchsia-500/30",
      iconBg: "bg-fuchsia-500/15",
      iconText: "text-fuchsia-400",
      checkBg: "bg-fuchsia-500",
    },
  },
  ursinho: {
    id: "ursinho",
    coverImage: "/nichos/ursinho.webp",
    cardDescription:
      "Máquinas de ursinho com leitura por entrada, foto do visor e apuração por brindes.",
    accent: {
      border: "border-pink-500",
      ring: "ring-pink-500/30",
      iconBg: "bg-pink-500/15",
      iconText: "text-pink-400",
      checkBg: "bg-pink-500",
    },
  },
  diversao: {
    id: "diversao",
    coverImage: "/nichos/outros.webp",
    cardDescription:
      "Sinuca, fliperama, cadeira de massagem e outras máquinas de entrada única — sem brindes.",
    accent: {
      border: "border-cyan-500",
      ring: "ring-cyan-500/30",
      iconBg: "bg-cyan-500/15",
      iconText: "text-cyan-400",
      checkBg: "bg-cyan-500",
    },
  },
  bolinha: {
    id: "bolinha",
    coverImage: "/nichos/ursinho.webp",
    cardDescription:
      "Máquinas de bolinha e cápsula com leitura por entrada, foto do visor e controle de estoque.",
    accent: {
      border: "border-orange-500",
      ring: "ring-orange-500/30",
      iconBg: "bg-orange-500/15",
      iconText: "text-orange-400",
      checkBg: "bg-orange-500",
    },
  },
  consignado: {
    id: "consignado",
    coverImage: "/nichos/outros.webp",
    cardDescription:
      "Venda consignada em comércios: produtos em expositores, baixa pela sobra e comissão do comércio.",
    accent: {
      border: "border-amber-500",
      ring: "ring-amber-500/30",
      iconBg: "bg-amber-500/15",
      iconText: "text-amber-400",
      checkBg: "bg-amber-500",
    },
  },
  outros: {
    id: "outros",
    coverImage: "/nichos/outros.webp",
    cardDescription:
      "Outros modelos de operação com pontos físicos, visitas e controle financeiro simplificado.",
    accent: {
      border: "border-slate-400",
      ring: "ring-slate-400/30",
      iconBg: "bg-slate-500/15",
      iconText: "text-at-primary/85",
      checkBg: "bg-slate-400",
    },
  },
};

/** Nichos exibidos como cards no carrossel (planos contratáveis). */
export const NICHO_CARDS_EXIBICAO: Nicho[] = [
  "fura_fura",
  "maquinas_cassino",
  "ursinho",
  "diversao",
  "bolinha",
  "consignado",
  "vending_ursinho",
  "outros",
];

export function nichosCardsParaExibir(_nichosContratados?: Nicho[]): Nicho[] {
  return NICHO_CARDS_EXIBICAO;
}

export function nichoEstaContratado(nicho: Nicho, nichosContratados: Nicho[]): boolean {
  if (nicho === "outros") {
    const principais = nichosContratados.filter((n) => n !== "outros");
    return principais.length === 0 && nichosContratados.includes("outros");
  }
  return nichosContratados.includes(nicho);
}
