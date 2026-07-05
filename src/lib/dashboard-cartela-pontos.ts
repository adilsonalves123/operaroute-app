import type { SupabaseClient } from "@supabase/supabase-js";
import type { PontoStatus } from "@/lib/types/database";

export type CartelaPontoItem = {
  id: string;
  nome: string;
  motivo?: string;
  data: string;
};

export type CartelaPeriodo = {
  captados: CartelaPontoItem[];
  encerrados: CartelaPontoItem[];
  saldo: number;
};

export type CartelaPontos = {
  semana: CartelaPeriodo;
  mes: CartelaPeriodo;
  ativosAgora: number;
};

type MovimentoRow = {
  ponto_id: string | null;
  ponto_nome: string;
  tipo: "entrada" | "saida";
  motivo: string;
  created_at: string;
};

type PontoRow = {
  id: string;
  nome: string;
  status: PontoStatus;
  created_at: string;
  status_alterado_em?: string | null;
};

const STATUS_ENCERRADO = new Set<PontoStatus>(["retirado", "pausado", "inadimplente"]);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function filtrarEntre<T extends { data: string }>(
  items: T[],
  inicio: Date,
  fim: Date
): T[] {
  const t0 = inicio.getTime();
  const t1 = fim.getTime();
  return items.filter((i) => {
    const t = new Date(i.data).getTime();
    return t >= t0 && t <= t1;
  });
}

function dedupePorPonto(items: CartelaPontoItem[]): CartelaPontoItem[] {
  const vistos = new Set<string>();
  const out: CartelaPontoItem[] = [];
  for (const item of items) {
    const key = `${item.id}:${item.motivo ?? ""}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push(item);
  }
  return out.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

function agregarPeriodo(captados: CartelaPontoItem[], encerrados: CartelaPontoItem[]): CartelaPeriodo {
  const c = dedupePorPonto(captados);
  const e = dedupePorPonto(encerrados);
  return {
    captados: c,
    encerrados: e,
    saldo: c.length - e.length,
  };
}

function movimentosToItems(movimentos: MovimentoRow[]): {
  captados: CartelaPontoItem[];
  encerrados: CartelaPontoItem[];
} {
  const captados: CartelaPontoItem[] = [];
  const encerrados: CartelaPontoItem[] = [];

  for (const m of movimentos) {
    const item: CartelaPontoItem = {
      id: m.ponto_id ?? m.ponto_nome,
      nome: m.ponto_nome,
      motivo: m.motivo,
      data: m.created_at,
    };
    if (m.tipo === "entrada") captados.push(item);
    else encerrados.push(item);
  }

  return { captados, encerrados };
}

function legacyFromPontos(
  pontos: PontoRow[],
  movimentos: MovimentoRow[]
): { captados: CartelaPontoItem[]; encerrados: CartelaPontoItem[] } {
  const idsComEntrada = new Set(
    movimentos.filter((m) => m.tipo === "entrada" && m.ponto_id).map((m) => m.ponto_id!)
  );
  const idsComSaida = new Set(
    movimentos.filter((m) => m.tipo === "saida" && m.ponto_id).map((m) => m.ponto_id!)
  );

  const captados: CartelaPontoItem[] = [];
  const encerrados: CartelaPontoItem[] = [];

  for (const p of pontos) {
    if (!idsComEntrada.has(p.id)) {
      captados.push({
        id: p.id,
        nome: p.nome,
        motivo: "cadastro",
        data: p.created_at,
      });
    }

    if (
      STATUS_ENCERRADO.has(p.status) &&
      p.status_alterado_em &&
      !idsComSaida.has(p.id)
    ) {
      encerrados.push({
        id: p.id,
        nome: p.nome,
        motivo: p.status,
        data: p.status_alterado_em,
      });
    }
  }

  return { captados, encerrados };
}

export function computeCartelaPontos(
  movimentos: MovimentoRow[],
  pontos: PontoRow[]
): CartelaPontos {
  const agora = new Date();
  const hoje = startOfDay(agora);
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(inicioSemana.getDate() - 6);
  const inicioMes = startOfMonth(agora);

  const fromMov = movimentosToItems(movimentos);
  const legacy = legacyFromPontos(pontos, movimentos);

  const todosCaptados = [...fromMov.captados, ...legacy.captados];
  const todosEncerrados = [...fromMov.encerrados, ...legacy.encerrados];

  return {
    semana: agregarPeriodo(
      filtrarEntre(todosCaptados, inicioSemana, agora),
      filtrarEntre(todosEncerrados, inicioSemana, agora)
    ),
    mes: agregarPeriodo(
      filtrarEntre(todosCaptados, inicioMes, agora),
      filtrarEntre(todosEncerrados, inicioMes, agora)
    ),
    ativosAgora: pontos.filter((p) => p.status === "ativo").length,
  };
}

export async function fetchCartelaPontos(
  supabase: SupabaseClient,
  empresaId: string
): Promise<CartelaPontos> {
  const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

  let pontosRows: PontoRow[] = [];

  const pontosResult = await supabase
    .from("pontos")
    .select("id, nome, status, created_at, status_alterado_em")
    .eq("empresa_id", empresaId);

  if (
    pontosResult.error?.message &&
    pontosResult.error.message.toLowerCase().includes("status_alterado_em")
  ) {
    const fallback = await supabase
      .from("pontos")
      .select("id, nome, status, created_at")
      .eq("empresa_id", empresaId);
    pontosRows = (fallback.data ?? []) as PontoRow[];
  } else {
    pontosRows = (pontosResult.data ?? []) as PontoRow[];
  }

  const movimentosResult = await supabase
    .from("pontos_movimentos")
    .select("ponto_id, ponto_nome, tipo, motivo, created_at")
    .eq("empresa_id", empresaId)
    .gte("created_at", thirtyFiveDaysAgo)
    .order("created_at", { ascending: false });

  const movimentos =
    movimentosResult.error &&
    movimentosResult.error.message.toLowerCase().includes("pontos_movimentos")
      ? []
      : (movimentosResult.data ?? []);

  return computeCartelaPontos(
    movimentos as MovimentoRow[],
    pontosRows
  );
}

export function labelMotivoCartela(motivo?: string): string {
  switch (motivo) {
    case "cadastro":
      return "Novo";
    case "reativacao":
      return "Reativado";
    case "retirado":
      return "Retirado";
    case "pausado":
      return "Pausado";
    case "inadimplente":
      return "Inadimplente";
    case "exclusao":
      return "Excluído";
    default:
      return motivo ?? "";
  }
}

export function mensagemCartela(cartela: CartelaPontos): string {
  const saldo = cartela.mes.saldo;
  const cap = cartela.mes.captados.length;
  const enc = cartela.mes.encerrados.length;

  if (cap === 0 && enc === 0) {
    return "Nenhuma movimentação na base de pontos neste mês.";
  }
  if (saldo > 0) {
    return `Base cresceu ${saldo > 1 ? `${saldo} pontos` : "1 ponto"} este mês — ${cap} captado${cap === 1 ? "" : "s"}.`;
  }
  if (saldo < 0) {
    return `Base encolheu ${Math.abs(saldo)} ponto${Math.abs(saldo) === 1 ? "" : "s"} — ${enc} encerrado${enc === 1 ? "" : "s"}.`;
  }
  return `${cap} captado${cap === 1 ? "" : "s"} e ${enc} encerrado${enc === 1 ? "" : "s"} — base estável.`;
}
