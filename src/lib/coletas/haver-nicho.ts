import type { SupabaseClient } from "@supabase/supabase-js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isHaverNicho(
  p: { tipo?: string | null; titulo?: string | null },
  tituloKeyword: string
): boolean {
  if ((p.tipo ?? "").toLowerCase() !== "haver") return false;
  const titulo = (p.titulo ?? "").toLowerCase();
  const key = tituloKeyword.toLowerCase();
  return titulo.includes(key);
}

export function somarHaverNichoAberto(
  pendencias: { tipo?: string | null; titulo?: string | null; valor?: number | null }[],
  tituloKeyword: string
): number {
  let total = 0;
  for (const p of pendencias) {
    if (!isHaverNicho(p, tituloKeyword)) continue;
    const v = Number(p.valor ?? 0);
    if (v > 0.009) total += v;
  }
  return round2(total);
}

/** Soma todo haver aberto do ponto (qualquer nicho) — tela Cobrar da visita. */
export function somarHaverPontoAberto(
  pendencias: { tipo?: string | null; valor?: number | null }[]
): number {
  let total = 0;
  for (const p of pendencias) {
    if ((p.tipo ?? "").toLowerCase() !== "haver") continue;
    const v = Number(p.valor ?? 0);
    if (v > 0.009) total += v;
  }
  return round2(total);
}

export async function fetchHaverSaldoPonto(
  supabase: SupabaseClient,
  empresaId: string,
  pontoId: string
): Promise<number> {
  const { data } = await supabase
    .from("pendencias")
    .select("tipo, valor")
    .eq("empresa_id", empresaId)
    .eq("ponto_id", pontoId)
    .eq("status", "aberta")
    .ilike("tipo", "haver");
  return somarHaverPontoAberto(data ?? []);
}

/** Consome haver aberto do nicho (reduz saldo ou fecha a pendência). */
export async function baixarHaverNicho(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    tituloKeyword: string;
    valor: number;
    /** Tag para restaurar ao excluir a coleta. */
    coletaId?: string;
  }
): Promise<{ baixado: number }> {
  return baixarHaverInterno(supabase, {
    empresaId: opts.empresaId,
    pontoId: opts.pontoId,
    valor: opts.valor,
    tituloKeyword: opts.tituloKeyword,
    coletaId: opts.coletaId,
  });
}

/** Consome haver aberto do ponto (todos os nichos), FIFO. */
export async function baixarHaverPonto(
  supabase: SupabaseClient,
  opts: { empresaId: string; pontoId: string; valor: number; coletaId?: string }
): Promise<{ baixado: number }> {
  return baixarHaverInterno(supabase, {
    empresaId: opts.empresaId,
    pontoId: opts.pontoId,
    valor: opts.valor,
    coletaId: opts.coletaId,
  });
}

async function baixarHaverInterno(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    valor: number;
    tituloKeyword?: string;
    coletaId?: string;
  }
): Promise<{ baixado: number }> {
  const alvo = round2(opts.valor);
  if (alvo <= 0.009) return { baixado: 0 };

  const { data: rows } = await supabase
    .from("pendencias")
    .select("id, valor, descricao, titulo, tipo")
    .eq("empresa_id", opts.empresaId)
    .eq("ponto_id", opts.pontoId)
    .eq("status", "aberta")
    .ilike("tipo", "haver")
    .order("created_at", { ascending: true });

  const havers = (rows ?? []).filter((p) =>
    opts.tituloKeyword
      ? isHaverNicho(p, opts.tituloKeyword)
      : (p.tipo ?? "").toLowerCase() === "haver"
  );
  let restante = alvo;
  let baixado = 0;
  const dataStr = new Date().toLocaleDateString("pt-BR");
  const tag = opts.coletaId ? ` [coleta:${opts.coletaId}]` : "";

  for (const h of havers) {
    if (restante <= 0.009) break;
    const saldo = round2(Number(h.valor ?? 0));
    if (saldo <= 0.009) continue;
    const chunk = round2(Math.min(saldo, restante));
    const novo = round2(saldo - chunk);
    const linha = `Abatido R$ ${chunk.toFixed(2).replace(".", ",")} em ${dataStr}${tag}`;

    if (novo <= 0.009) {
      await supabase
        .from("pendencias")
        .update({
          valor: 0,
          status: "resolvida",
          descricao: h.descricao ? `${h.descricao}\n${linha}` : linha,
        })
        .eq("id", h.id);
    } else {
      await supabase
        .from("pendencias")
        .update({
          valor: novo,
          descricao: h.descricao ? `${h.descricao}\n${linha}` : linha,
        })
        .eq("id", h.id);
    }
    restante = round2(restante - chunk);
    baixado = round2(baixado + chunk);
  }

  return { baixado };
}
