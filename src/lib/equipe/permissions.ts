import type { UserRole } from "@/lib/types/database";

export const PERMISSAO_ACOES = ["ver", "criar", "editar", "excluir"] as const;
export type PermissaoAcao = (typeof PERMISSAO_ACOES)[number];

export const PERMISSAO_MODULOS = [
  "dashboard",
  "analise",
  "pontos",
  "coletas",
  "financeiro",
  "pendencias",
  "chamados",
  "estoque",
  "rotas",
  "equipe",
  "relatorios",
  "ia",
  "universidade",
  "certificados",
  "materiais",
  "suporte",
  "auditoria",
  "configuracoes",
  "planos",
] as const;

export type PermissaoModulo = (typeof PERMISSAO_MODULOS)[number];

export type PermissaoModuloConfig = Record<PermissaoAcao, boolean>;

export type PermissoesResolvidas = Record<PermissaoModulo, PermissaoModuloConfig>;

/** Overrides salvos em equipe.permissoes (parcial por módulo/ação). */
export type PermissoesOverrides = Partial<
  Record<PermissaoModulo, Partial<PermissaoModuloConfig>>
>;

export const MODULO_LABELS: Record<PermissaoModulo, string> = {
  dashboard: "Dashboard",
  analise: "Análise",
  pontos: "Pontos / Clientes",
  coletas: "Coletas",
  financeiro: "Financeiro",
  pendencias: "Pendências",
  chamados: "Chamados / Manutenção",
  estoque: "Estoque",
  rotas: "Rotas",
  equipe: "Equipe",
  relatorios: "Relatórios",
  ia: "IA do Sistema",
  universidade: "Universidade",
  certificados: "Certificados",
  materiais: "Materiais",
  suporte: "Suporte",
  auditoria: "Auditoria",
  configuracoes: "Configurações",
  planos: "Planos",
};

export const ACAO_LABELS: Record<PermissaoAcao, string> = {
  ver: "Ver",
  criar: "Criar",
  editar: "Editar",
  excluir: "Excluir",
};

/** Ações relevantes na UI da matriz (o que ainda não existe no módulo fica fora). */
export type MatrizAcaoUi = PermissaoAcao | "gerenciar";

export type ModuloPermissaoMeta = {
  grupo: "operacao" | "gestao" | "conteudo" | "sistema";
  /** Colunas exibidas na matriz */
  acoesUi: MatrizAcaoUi[];
  /** Texto curto sob o nome do módulo */
  dica?: string;
};

export const GRUPO_MODULO_LABELS: Record<ModuloPermissaoMeta["grupo"], string> = {
  operacao: "Operação",
  gestao: "Gestão",
  conteudo: "Ajuda",
  sistema: "Sistema",
};

/** Módulos ocultos na UI (rotas redirecionam; permissões antigas no JSON seguem válidas). */
const MODULOS_OCULTOS_UI: ReadonlySet<PermissaoModulo> = new Set([
  "certificados",
  "materiais",
]);

export const MODULO_PERMISSAO_META: Record<PermissaoModulo, ModuloPermissaoMeta> = {
  dashboard: { grupo: "gestao", acoesUi: ["ver"] },
  analise: { grupo: "gestao", acoesUi: ["ver"] },
  pontos: { grupo: "operacao", acoesUi: ["ver", "criar", "editar", "excluir"] },
  coletas: { grupo: "operacao", acoesUi: ["ver", "criar", "editar"] },
  financeiro: { grupo: "gestao", acoesUi: ["ver", "criar", "editar", "excluir"] },
  pendencias: { grupo: "operacao", acoesUi: ["ver", "criar", "editar"] },
  chamados: { grupo: "operacao", acoesUi: ["ver", "criar", "editar"] },
  estoque: { grupo: "operacao", acoesUi: ["ver", "criar", "editar", "excluir"] },
  rotas: {
    grupo: "operacao",
    acoesUi: ["ver", "gerenciar"],
    dica: "Ver = executar Minha rota · Gerenciar = montar e enviar",
  },
  equipe: {
    grupo: "gestao",
    acoesUi: ["ver"],
    dica: "Gerenciar membros exige função Gerente ou Administrador",
  },
  relatorios: { grupo: "gestao", acoesUi: ["ver"] },
  ia: { grupo: "gestao", acoesUi: ["ver"] },
  universidade: {
    grupo: "conteudo",
    acoesUi: ["ver"],
    dica: "Vídeos de como usar o sistema",
  },
  certificados: { grupo: "conteudo", acoesUi: ["ver"] },
  materiais: { grupo: "conteudo", acoesUi: ["ver"] },
  suporte: {
    grupo: "sistema",
    acoesUi: ["ver", "criar"],
    dica: "Chat com IA e, se precisar, atendimento humano OperaRoute",
  },
  auditoria: {
    grupo: "sistema",
    acoesUi: ["ver"],
    dica: "Trilha de acessos, edições e anomalias da operação",
  },
  configuracoes: { grupo: "sistema", acoesUi: ["ver", "editar"] },
  planos: {
    grupo: "sistema",
    acoesUi: ["ver"],
    dica: "Troca de plano fica com o dono da operação",
  },
};

export const MODULOS_POR_GRUPO: {
  id: ModuloPermissaoMeta["grupo"];
  modulos: PermissaoModulo[];
}[] = (
  ["operacao", "gestao", "conteudo", "sistema"] as const
).map((id) => ({
  id,
  modulos: PERMISSAO_MODULOS.filter(
    (m) => MODULO_PERMISSAO_META[m].grupo === id && !MODULOS_OCULTOS_UI.has(m)
  ),
}));

export function moduloTemGerenciarRotas(cfg: PermissaoModuloConfig): boolean {
  return Boolean(cfg.criar || cfg.editar || cfg.excluir);
}

export function aplicarGerenciarRotas(
  cfg: PermissaoModuloConfig,
  ligado: boolean
): PermissaoModuloConfig {
  if (ligado) {
    return { ver: true, criar: true, editar: true, excluir: true };
  }
  return { ...cfg, criar: false, editar: false, excluir: false };
}

export function podeGerenciarRotasPermissao(permissoes: PermissoesResolvidas): boolean {
  return moduloTemGerenciarRotas(permissoes.rotas);
}

const T = {
  ver: true,
  criar: true,
  editar: true,
  excluir: true,
} satisfies PermissaoModuloConfig;

const V = {
  ver: true,
  criar: false,
  editar: false,
  excluir: false,
} satisfies PermissaoModuloConfig;

const VE = {
  ver: true,
  criar: true,
  editar: true,
  excluir: false,
} satisfies PermissaoModuloConfig;

const N = {
  ver: false,
  criar: false,
  editar: false,
  excluir: false,
} satisfies PermissaoModuloConfig;

function padraoAdmin(): PermissoesResolvidas {
  return Object.fromEntries(
    PERMISSAO_MODULOS.map((m) => [m, { ...T }])
  ) as PermissoesResolvidas;
}

function padraoGerente(): PermissoesResolvidas {
  return {
    dashboard: { ...T },
    analise: { ...V },
    pontos: { ...T },
    coletas: { ...T },
    financeiro: { ...T },
    pendencias: { ...T },
    chamados: { ...T },
    estoque: { ...T },
    rotas: { ...T },
    equipe: { ...T },
    relatorios: { ...V },
    ia: { ...V },
    universidade: { ...V },
    certificados: { ...V },
    materiais: { ...V },
    suporte: { ver: true, criar: true, editar: false, excluir: false },
    auditoria: { ...V },
    configuracoes: { ver: true, criar: false, editar: true, excluir: false },
    planos: { ...V },
  };
}

function padraoOperador(): PermissoesResolvidas {
  return {
    dashboard: { ...V },
    analise: { ...N },
    pontos: { ...V },
    coletas: { ...VE },
    financeiro: { ...N },
    pendencias: { ...VE },
    chamados: { ...VE },
    estoque: { ...N },
    rotas: { ...V },
    equipe: { ...N },
    relatorios: { ...N },
    ia: { ...N },
    universidade: { ...V },
    certificados: { ...V },
    materiais: { ...V },
    suporte: { ver: true, criar: true, editar: false, excluir: false },
    auditoria: { ...N },
    configuracoes: { ...N },
    planos: { ...N },
  };
}

function padraoVisualizador(): PermissoesResolvidas {
  return {
    dashboard: { ...V },
    analise: { ...V },
    pontos: { ...V },
    coletas: { ...V },
    financeiro: { ...V },
    pendencias: { ...V },
    chamados: { ...V },
    estoque: { ...V },
    rotas: { ...V },
    equipe: { ...N },
    relatorios: { ...V },
    ia: { ...V },
    universidade: { ...V },
    certificados: { ...V },
    materiais: { ...V },
    suporte: { ver: true, criar: true, editar: false, excluir: false },
    auditoria: { ...N },
    configuracoes: { ...N },
    planos: { ...N },
  };
}

export function permissoesPadraoRole(role: UserRole): PermissoesResolvidas {
  switch (role) {
    case "admin":
      return padraoAdmin();
    case "gerente":
      return padraoGerente();
    case "visualizador":
      return padraoVisualizador();
    default:
      return padraoOperador();
  }
}

export function mesclarPermissoes(
  role: UserRole,
  overrides?: PermissoesOverrides | null
): PermissoesResolvidas {
  const base = permissoesPadraoRole(role);
  if (!overrides) return base;

  const out = { ...base };
  for (const modulo of PERMISSAO_MODULOS) {
    const custom = overrides[modulo];
    if (!custom) continue;
    out[modulo] = {
      ...base[modulo],
      ...custom,
    };
  }
  return out;
}

export function pode(
  permissoes: PermissoesResolvidas,
  modulo: PermissaoModulo,
  acao: PermissaoAcao
): boolean {
  return Boolean(permissoes[modulo]?.[acao]);
}

export function podeVer(permissoes: PermissoesResolvidas, modulo: PermissaoModulo): boolean {
  return pode(permissoes, modulo, "ver");
}

export function podeEditar(permissoes: PermissoesResolvidas, modulo: PermissaoModulo): boolean {
  return (
    pode(permissoes, modulo, "editar") ||
    pode(permissoes, modulo, "criar") ||
    pode(permissoes, modulo, "excluir")
  );
}

export function moduloDaRota(pathname: string): PermissaoModulo | null {
  const p = pathname.split("?")[0];
  if (p === "/" || p.startsWith("/dashboard")) return "dashboard";
  if (p.startsWith("/analise")) return "analise";
  if (p.startsWith("/pontos")) return "pontos";
  if (p.startsWith("/equipamentos")) return "pontos";
  if (p.startsWith("/coletas")) return "coletas";
  if (p.startsWith("/financeiro")) return "financeiro";
  if (p.startsWith("/pendencias")) return "pendencias";
  if (p.startsWith("/chamados")) return "chamados";
  if (p.startsWith("/estoque")) return "estoque";
  if (p.startsWith("/produtos-consignados")) return "estoque";
  if (p.startsWith("/rotas")) return "rotas";
  if (p.startsWith("/equipe")) return "equipe";
  if (p.startsWith("/relatorios")) return "relatorios";
  if (p.startsWith("/ia")) return "ia";
  if (p.startsWith("/universidade")) return "universidade";
  if (p.startsWith("/certificados")) return "certificados";
  if (p.startsWith("/materiais")) return "materiais";
  if (p.startsWith("/suporte")) return "suporte";
  if (p.startsWith("/auditoria")) return "auditoria";
  if (p.startsWith("/planos")) return "planos";
  if (p.startsWith("/configuracoes")) return "configuracoes";
  return null;
}

export function acaoApiParaModulo(
  method: string
): PermissaoAcao {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") return "ver";
  if (m === "POST") return "criar";
  if (m === "PATCH" || m === "PUT") return "editar";
  return "excluir";
}

export function normalizarOverrides(raw: unknown): PermissoesOverrides | null {
  if (!raw || typeof raw !== "object") return null;
  const out: PermissoesOverrides = {};
  for (const modulo of PERMISSAO_MODULOS) {
    const mod = (raw as Record<string, unknown>)[modulo];
    if (!mod || typeof mod !== "object") continue;
    const cfg: Partial<PermissaoModuloConfig> = {};
    for (const acao of PERMISSAO_ACOES) {
      const val = (mod as Record<string, unknown>)[acao];
      if (typeof val === "boolean") cfg[acao] = val;
    }
    if (Object.keys(cfg).length > 0) out[modulo] = cfg;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function overridesDaMatriz(
  role: UserRole,
  matriz: PermissoesResolvidas
): PermissoesOverrides | null {
  const padrao = permissoesPadraoRole(role);
  const diff: PermissoesOverrides = {};
  let temDiff = false;

  for (const modulo of PERMISSAO_MODULOS) {
    const custom: Partial<PermissaoModuloConfig> = {};
    let modDiff = false;
    for (const acao of PERMISSAO_ACOES) {
      if (matriz[modulo][acao] !== padrao[modulo][acao]) {
        custom[acao] = matriz[modulo][acao];
        modDiff = true;
      }
    }
    if (modDiff) {
      diff[modulo] = custom;
      temDiff = true;
    }
  }

  return temDiff ? diff : null;
}
