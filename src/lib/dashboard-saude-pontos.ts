import type { SupabaseClient } from "@supabase/supabase-js";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import type { PulsoEvento } from "@/lib/dashboard-pulso";
import { NICHO_MODULO_FURA_FURA } from "@/lib/nichos/fura-fura";

export type SaudePontoClasse = "forte" | "razoavel" | "fraco" | "sem_dados";

export type PontoSaudeItem = {
  pontoId: string;
  nome: string;
  classe: SaudePontoClasse;
  indice: number | null;
  lucroMes: number;
  impulsos: number;
  pressoes: number;
  visitas: number;
};

export type SaudePontosResumo = {
  mes: PontoSaudeItem[];
  semana: PontoSaudeItem[];
  contagem: {
    forte: number;
    razoavel: number;
    fraco: number;
    semDados: number;
  };
};

export type PulsoEventoPonto = PulsoEvento & {
  ponto_id: string;
  ponto_nome: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function filtrarEntre(eventos: PulsoEventoPonto[], inicio: Date, fim: Date): PulsoEventoPonto[] {
  const t0 = inicio.getTime();
  const t1 = fim.getTime();
  return eventos.filter((e) => {
    const t = new Date(e.created_at).getTime();
    return t >= t0 && t <= t1;
  });
}

function classificarEvento(e: PulsoEvento): "impulso" | "pressao" | "neutro" {
  if (e.negativa || e.lucroReais < -0.009) return "pressao";
  if (e.lucroReais > 0.009) return "impulso";
  return "neutro";
}

export function classificarSaudePonto(stats: {
  impulsos: number;
  pressoes: number;
  lucroMes: number;
  visitas: number;
}): SaudePontoClasse {
  const decisivos = stats.impulsos + stats.pressoes;
  if (stats.visitas === 0 || decisivos === 0) return "sem_dados";

  const indice = (stats.impulsos / decisivos) * 100;

  if (indice >= 75 && stats.lucroMes >= -0.009) return "forte";
  if (indice < 45 || stats.lucroMes < -0.009 || stats.pressoes > stats.impulsos) return "fraco";
  return "razoavel";
}

function agregarPorPonto(eventos: PulsoEventoPonto[]): PontoSaudeItem[] {
  const map = new Map<
    string,
    {
      nome: string;
      impulsos: number;
      pressoes: number;
      lucroMes: number;
      visitas: number;
    }
  >();

  for (const e of eventos) {
    const prev = map.get(e.ponto_id) ?? {
      nome: e.ponto_nome,
      impulsos: 0,
      pressoes: 0,
      lucroMes: 0,
      visitas: 0,
    };
    prev.visitas++;
    prev.lucroMes += e.lucroReais;
    const tipo = classificarEvento(e);
    if (tipo === "impulso") prev.impulsos++;
    else if (tipo === "pressao") prev.pressoes++;
    map.set(e.ponto_id, prev);
  }

  return [...map.entries()].map(([pontoId, s]) => {
    const decisivos = s.impulsos + s.pressoes;
    const indice =
      decisivos > 0 ? Math.round((s.impulsos / decisivos) * 1000) / 10 : null;
    const classe = classificarSaudePonto({
      impulsos: s.impulsos,
      pressoes: s.pressoes,
      lucroMes: s.lucroMes,
      visitas: s.visitas,
    });
    return {
      pontoId,
      nome: s.nome,
      classe,
      indice,
      lucroMes: Math.round(s.lucroMes * 100) / 100,
      impulsos: s.impulsos,
      pressoes: s.pressoes,
      visitas: s.visitas,
    };
  });
}

function contarClasses(itens: PontoSaudeItem[]) {
  return {
    forte: itens.filter((i) => i.classe === "forte").length,
    razoavel: itens.filter((i) => i.classe === "razoavel").length,
    fraco: itens.filter((i) => i.classe === "fraco").length,
    semDados: itens.filter((i) => i.classe === "sem_dados").length,
  };
}

export function computeSaudePontos(eventos: PulsoEventoPonto[]): SaudePontosResumo {
  const agora = new Date();
  const hoje = startOfDay(agora);
  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(inicioSemana.getDate() - 6);
  const inicioMes = startOfMonth(agora);

  const mes = agregarPorPonto(filtrarEntre(eventos, inicioMes, agora)).sort(ordenarSaude);
  const semana = agregarPorPonto(filtrarEntre(eventos, inicioSemana, agora)).sort(ordenarSaude);

  return {
    mes,
    semana,
    contagem: contarClasses(mes),
  };
}

function ordenarSaude(a: PontoSaudeItem, b: PontoSaudeItem): number {
  const ordem: Record<SaudePontoClasse, number> = {
    forte: 0,
    razoavel: 1,
    fraco: 2,
    sem_dados: 3,
  };
  const diff = ordem[a.classe] - ordem[b.classe];
  if (diff !== 0) return diff;
  return (b.indice ?? -1) - (a.indice ?? -1);
}

export function labelSaude(classe: SaudePontoClasse): string {
  switch (classe) {
    case "forte":
      return "Ponto forte";
    case "razoavel":
      return "Ponto razoável";
    case "fraco":
      return "Ponto fraco";
    default:
      return "Sem leitura";
  }
}

export function mensagemSaudeResumo(resumo: SaudePontosResumo): string {
  const { forte, razoavel, fraco } = resumo.contagem;
  const total = forte + razoavel + fraco;
  if (total === 0) return "Faça coletas para classificar seus pontos.";
  if (forte > 0 && fraco === 0) {
    return `${forte} ponto${forte === 1 ? "" : "s"} forte${forte === 1 ? "" : "s"} este mês — carteira em boa forma.`;
  }
  if (fraco > 0) {
    return `${fraco} ponto${fraco === 1 ? "" : "s"} pede${fraco === 1 ? "" : "m"} atenção — priorize visita e ajuste.`;
  }
  return `${razoavel} ponto${razoavel === 1 ? "" : "s"} no ritmo — margem para evoluir para forte.`;
}

export function visitasToEventosPonto(
  visitas: {
    ponto_id: string;
    total_lucro_centavos: number | null;
    saldo_negativo: boolean | null;
    created_at: string;
    pontos: { nome: string } | { nome: string }[] | null;
  }[]
): PulsoEventoPonto[] {
  return visitas.map((v) => {
    const lucroReais = centesimosToReais(Number(v.total_lucro_centavos ?? 0));
    const ponto = Array.isArray(v.pontos) ? v.pontos[0] : v.pontos;
    return {
      ponto_id: v.ponto_id,
      ponto_nome: ponto?.nome ?? "Ponto",
      created_at: v.created_at,
      lucroReais,
      negativa: Boolean(v.saldo_negativo) || lucroReais < -0.009,
    };
  });
}

export function coletasToEventosPonto(
  coletas: {
    id: string;
    ponto_id: string;
    visita_id: string | null;
    created_at: string;
    lucro_centavos: number | null;
    lucro_real?: number | null;
    valor_liquido: number | null;
    valor_bruto: number | null;
    entrada: number | null;
    pontos: { nome: string } | { nome: string }[] | null;
  }[]
): PulsoEventoPonto[] {
  const grupos = new Map<
    string,
    {
      ponto_id: string;
      ponto_nome: string;
      lucroReais: number;
      negativa: boolean;
      created_at: string;
    }
  >();

  for (const c of coletas) {
    const ponto = Array.isArray(c.pontos) ? c.pontos[0] : c.pontos;
    const key = c.visita_id ?? `${c.ponto_id}:${c.created_at.slice(0, 10)}`;
    const lucro =
      c.lucro_real != null
        ? Number(c.lucro_real)
        : c.lucro_centavos != null
          ? centesimosToReais(Number(c.lucro_centavos))
          : Number(c.valor_liquido ?? c.valor_bruto ?? c.entrada ?? 0);
    const prev = grupos.get(key);
    if (prev) {
      prev.lucroReais += lucro;
      prev.negativa = prev.negativa || lucro < -0.009;
    } else {
      grupos.set(key, {
        ponto_id: c.ponto_id,
        ponto_nome: ponto?.nome ?? "Ponto",
        lucroReais: lucro,
        negativa: lucro < -0.009,
        created_at: c.created_at,
      });
    }
  }

  return [...grupos.values()].map((g) => ({
    ponto_id: g.ponto_id,
    ponto_nome: g.ponto_nome,
    created_at: g.created_at,
    lucroReais: g.lucroReais,
    negativa: g.negativa || g.lucroReais < -0.009,
  }));
}

export async function fetchSaudePontos(
  supabase: SupabaseClient,
  empresaId: string,
  nicho: "cassino" | "generico" | "fura_fura"
): Promise<SaudePontosResumo> {
  const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

  let coletasData: Parameters<typeof coletasToEventosPonto>[0] = [];
  if (nicho !== "cassino") {
    let query = supabase
      .from("coletas")
      .select(
        "id, ponto_id, visita_id, created_at, lucro_centavos, lucro_real, valor_liquido, valor_bruto, entrada, pontos(nome), nicho_modulo"
      )
      .eq("empresa_id", empresaId)
      .gte("created_at", thirtyFiveDaysAgo);
    if (nicho === "fura_fura") {
      query = query.eq("nicho_modulo", NICHO_MODULO_FURA_FURA);
    }
    const { data } = await query;
    coletasData = (data ?? []) as Parameters<typeof coletasToEventosPonto>[0];
  }

  const [{ data: pontosAtivos }, visitasResult] = await Promise.all([
    supabase
      .from("pontos")
      .select("id, nome")
      .eq("empresa_id", empresaId)
      .eq("status", "ativo"),
    nicho === "cassino"
      ? supabase
          .from("visitas")
          .select(
            "ponto_id, total_lucro_centavos, saldo_negativo, created_at, pontos(nome)"
          )
          .eq("empresa_id", empresaId)
          .gte("created_at", thirtyFiveDaysAgo)
      : Promise.resolve({ data: null }),
  ]);

  const eventos =
    nicho === "cassino"
      ? visitasToEventosPonto(visitasResult.data ?? [])
      : coletasToEventosPonto(coletasData);

  const resumo = computeSaudePontos(eventos);
  const idsComVisitaMes = new Set(resumo.mes.map((p) => p.pontoId));

  for (const p of pontosAtivos ?? []) {
    if (!idsComVisitaMes.has(p.id)) {
      resumo.mes.push({
        pontoId: p.id,
        nome: p.nome,
        classe: "sem_dados",
        indice: null,
        lucroMes: 0,
        impulsos: 0,
        pressoes: 0,
        visitas: 0,
      });
    }
  }

  resumo.contagem = contarClasses(resumo.mes);
  return resumo;
}
