import { notifyEmpresaAdminsBackground } from "@/lib/push/notify-admins";

function money(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type BaseOpts = {
  empresaId: string;
  autorUserId?: string | null;
  autorNome?: string | null;
  pontoNome?: string | null;
};

function quem(opts: BaseOpts): string {
  return opts.autorNome?.trim() || "Operador";
}

function onde(opts: BaseOpts): string {
  return opts.pontoNome?.trim() || "ponto";
}

export function pushColetaRegistrada(
  opts: BaseOpts & {
    nichoLabel: string;
    valor: number;
    url?: string;
  }
) {
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: `Coleta · ${opts.nichoLabel}`,
      body: `${quem(opts)} em ${onde(opts)} · ${money(opts.valor)}`,
      url: opts.url ?? "/coletas",
      tag: `coleta-${opts.nichoLabel}`,
    },
    { excludeUserId: opts.autorUserId }
  );
}

export function pushColetaEditada(
  opts: BaseOpts & {
    nichoLabel: string;
    valor?: number;
    url?: string;
    coletaId?: string;
  }
) {
  const valorTxt =
    opts.valor != null && Number.isFinite(opts.valor) ? ` · ${money(opts.valor)}` : "";
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: `Coleta editada · ${opts.nichoLabel}`,
      body: `${quem(opts)} corrigiu coleta em ${onde(opts)}${valorTxt}`,
      url: opts.url ?? "/coletas",
      tag: opts.coletaId ? `coleta-edit-${opts.coletaId}` : "coleta-editada",
    },
    { excludeUserId: opts.autorUserId }
  );
}

/** Nova coleta ou correção (pagamento / regravação). */
export function pushColetaSalva(
  opts: BaseOpts & {
    nichoLabel: string;
    valor: number;
    url?: string;
    coletaId?: string;
    editando?: boolean;
  }
) {
  if (opts.editando) {
    pushColetaEditada({
      empresaId: opts.empresaId,
      autorUserId: opts.autorUserId,
      autorNome: opts.autorNome,
      pontoNome: opts.pontoNome,
      nichoLabel: opts.nichoLabel,
      valor: opts.valor,
      url: opts.url,
      coletaId: opts.coletaId,
    });
    return;
  }
  pushColetaRegistrada(opts);
}

export function pushPontoCriado(
  opts: BaseOpts & {
    pontoId?: string;
    equipamentos?: number;
  }
) {
  const qtd =
    opts.equipamentos != null && opts.equipamentos > 0
      ? ` · ${opts.equipamentos} máq.`
      : "";
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Novo ponto cadastrado",
      body: `${quem(opts)} cadastrou ${onde(opts)}${qtd}`,
      url: opts.pontoId ? `/pontos/${opts.pontoId}` : "/pontos",
      tag: opts.pontoId ? `ponto-${opts.pontoId}` : "ponto-novo",
    },
    { excludeUserId: opts.autorUserId }
  );
}

function labelTipoPendencia(tipo?: string | null): string {
  switch (tipo) {
    case "haver":
      return "Haver";
    case "negativo":
      return "Pendência negativa";
    case "parcial":
      return "Pagamento parcial";
    case "pagamento_pendente":
      return "Pagamento pendente";
    default:
      return "Pendência";
  }
}

export function pushPendenciaCriada(
  opts: BaseOpts & {
    titulo?: string | null;
    tipo?: string | null;
    valor: number;
    pendenciaId?: string;
  }
) {
  const titulo = opts.titulo?.trim() || labelTipoPendencia(opts.tipo);
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Pendência criada",
      body: `${quem(opts)} · ${onde(opts)} · ${titulo} · ${money(opts.valor)}`,
      url: "/pendencias",
      tag: opts.pendenciaId ? `pendencia-${opts.pendenciaId}` : "pendencia-nova",
    },
    { excludeUserId: opts.autorUserId }
  );
}

export function pushPendenciaExcluida(
  opts: BaseOpts & {
    titulo?: string | null;
    valor?: number;
    pendenciaId?: string;
  }
) {
  const valorTxt =
    opts.valor != null && Number.isFinite(opts.valor) ? ` · ${money(opts.valor)}` : "";
  const titulo = opts.titulo?.trim() || "Pendência";
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Pendência excluída",
      body: `${quem(opts)} removeu ${titulo} em ${onde(opts)}${valorTxt}`,
      url: "/pendencias",
      tag: opts.pendenciaId ? `pendencia-del-${opts.pendenciaId}` : "pendencia-excluida",
    },
    { excludeUserId: opts.autorUserId }
  );
}

export function pushPendenciaQuitada(
  opts: BaseOpts & {
    titulo?: string | null;
    valor?: number;
    pendenciaId?: string;
  }
) {
  const valorTxt =
    opts.valor != null && Number.isFinite(opts.valor) ? ` · ${money(opts.valor)}` : "";
  const titulo = opts.titulo?.trim() || "Pendência";
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Pendência quitada",
      body: `${quem(opts)} baixou ${titulo} em ${onde(opts)}${valorTxt}`,
      url: "/pendencias",
      tag: opts.pendenciaId ? `pendencia-ok-${opts.pendenciaId}` : "pendencia-quitada",
    },
    { excludeUserId: opts.autorUserId }
  );
}

export function pushChamadoAberto(
  opts: BaseOpts & {
    titulo: string;
    prioridade?: string;
    chamadoId: string;
  }
) {
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Manutenção · chamado aberto",
      body: `${quem(opts)} · ${onde(opts)}: ${opts.titulo}${
        opts.prioridade ? ` (${opts.prioridade})` : ""
      }`,
      url: "/chamados",
      tag: `chamado-${opts.chamadoId}`,
    },
    { excludeUserId: opts.autorUserId }
  );
}

export function pushChamadoConcluido(
  opts: BaseOpts & {
    titulo?: string | null;
    resumo?: string | null;
    chamadoId: string;
  }
) {
  const detalhe = (opts.resumo || opts.titulo || "Equipamento arrumado").slice(0, 120);
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Equipamento arrumado",
      body: `${quem(opts)} · ${onde(opts)}: ${detalhe}`,
      url: "/chamados",
      tag: `chamado-ok-${opts.chamadoId}`,
    },
    { excludeUserId: opts.autorUserId }
  );
}

export function pushSuporteMensagem(
  opts: BaseOpts & {
    preview: string;
    conversaId?: string | null;
  }
) {
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Suporte · nova mensagem",
      body: `${quem(opts)}: ${opts.preview.slice(0, 140)}`,
      url: "/suporte",
      tag: `suporte-${opts.conversaId ?? "msg"}`,
    },
    { excludeUserId: opts.autorUserId }
  );
}

/** Detecta correção de coleta no body da API. */
export function bodyEditandoColeta(body: Record<string, unknown>): boolean {
  return body.editando_coleta === true || Boolean(body.editar_coleta_id);
}
