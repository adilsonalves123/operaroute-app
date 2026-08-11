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

export function pushColetaRegistrada(
  opts: BaseOpts & {
    nichoLabel: string;
    valor: number;
    url?: string;
  }
) {
  const quem = opts.autorNome?.trim() || "Operador";
  const onde = opts.pontoNome?.trim() || "ponto";
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: `Coleta · ${opts.nichoLabel}`,
      body: `${quem} em ${onde} · ${money(opts.valor)}`,
      url: opts.url ?? "/coletas",
      tag: `coleta-${opts.nichoLabel}`,
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
  const quem = opts.autorNome?.trim() || "Operador";
  const onde = opts.pontoNome ? ` · ${opts.pontoNome}` : "";
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Manutenção · chamado aberto",
      body: `${quem}${onde}: ${opts.titulo}${
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
  const quem = opts.autorNome?.trim() || "Operador";
  const onde = opts.pontoNome ? ` · ${opts.pontoNome}` : "";
  const detalhe = (opts.resumo || opts.titulo || "Equipamento arrumado").slice(0, 120);
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Equipamento arrumado",
      body: `${quem}${onde}: ${detalhe}`,
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
  const quem = opts.autorNome?.trim() || "Equipe";
  notifyEmpresaAdminsBackground(
    opts.empresaId,
    {
      title: "Suporte · nova mensagem",
      body: `${quem}: ${opts.preview.slice(0, 140)}`,
      url: opts.conversaId ? "/suporte" : "/suporte",
      tag: `suporte-${opts.conversaId ?? "msg"}`,
    },
    { excludeUserId: opts.autorUserId }
  );
}
