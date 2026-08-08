import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoPendenteColeta } from "@/lib/nichos/fura-fura/pagamentos-fifo";
import { cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const TIPOS_COBRANCA = ["pagamento_pendente", "parcial", "visita_consolidada"] as const;

/**
 * Alinha pendências cobráveis do ponto com o saldo real das coletas/visitas.
 *
 * Bug clássico: pagamento atualiza `coletas.valor_pago_recebido` (análise some),
 * mas a linha em `pendencias` / `visita_consolidada` fica aberta (dashboard continua).
 */
export async function reconciliarPendenciasCobraveisPonto(
  supabase: SupabaseClient,
  opts: { empresaId: string; pontoId: string }
): Promise<{ ajustadas: number }> {
  const { empresaId, pontoId } = opts;
  let ajustadas = 0;
  const agora = new Date().toISOString();

  const { data: pendencias } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, coleta_id, visita_id, descricao")
    .eq("empresa_id", empresaId)
    .eq("ponto_id", pontoId)
    .eq("status", "aberta")
    .order("created_at", { ascending: true });

  const rows = (pendencias ?? []).filter((p) => {
    const tipo = (p.tipo ?? "").toLowerCase();
    if (tipo === "haver" || tipo === "negativo") return false;
    return true;
  });

  if (rows.length === 0) return { ajustadas: 0 };

  // 1) Pendências ligadas a coleta → espelham saldo da coleta
  for (const p of rows) {
    if (!p.coleta_id) continue;
    const { data: coleta } = await supabase
      .from("coletas")
      .select("valor_a_receber, valor_pago_recebido")
      .eq("id", p.coleta_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!coleta) continue;
    const saldo = saldoPendenteColeta(coleta);
    if (saldo <= 0.009) {
      await supabase
        .from("pendencias")
        .update({ status: "resolvida", valor: 0, resolvido_em: agora })
        .eq("id", p.id)
        .eq("empresa_id", empresaId);
      ajustadas++;
    } else if (Math.abs(Number(p.valor ?? 0) - saldo) > 0.019) {
      await supabase
        .from("pendencias")
        .update({ valor: saldo })
        .eq("id", p.id)
        .eq("empresa_id", empresaId);
      ajustadas++;
    }
  }

  // 2) Pendências ligadas a visita cassino (não negativo) → espelham cobravel
  for (const p of rows) {
    if (!p.visita_id || p.coleta_id) continue;
    const tipo = (p.tipo ?? "").toLowerCase();
    if (tipo === "negativo") continue;

    const { data: visita } = await supabase
      .from("visitas")
      .select(
        "id, valor_operacao_efetivo, valor_operacao, valor_pago, restante, debito_abatido, saldo_negativo"
      )
      .eq("id", p.visita_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    // Visita foi apagada e o FK ficou NULL/órfão — some a cobrança junto.
    if (!visita) {
      await supabase
        .from("pendencias")
        .delete()
        .eq("id", p.id)
        .eq("empresa_id", empresaId);
      ajustadas++;
      continue;
    }

    if (visita.saldo_negativo) continue;
    const saldo = cobravelCassinoVisita(visita);
    if (saldo <= 0.009) {
      await supabase
        .from("pendencias")
        .update({ status: "resolvida", valor: 0, resolvido_em: agora })
        .eq("id", p.id)
        .eq("empresa_id", empresaId);
      ajustadas++;
    } else if (Math.abs(Number(p.valor ?? 0) - saldo) > 0.019) {
      await supabase
        .from("pendencias")
        .update({ valor: saldo })
        .eq("id", p.id)
        .eq("empresa_id", empresaId);
      ajustadas++;
    }
  }

  // 2b) Órfãs de coleta cassino apagada (visita_id NULL + texto típico da dívida).
  const { data: orfasCassino } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, titulo, descricao, visita_id, coleta_id")
    .eq("empresa_id", empresaId)
    .eq("ponto_id", pontoId)
    .eq("status", "aberta")
    .is("visita_id", null)
    .is("coleta_id", null)
    .in("tipo", ["pagamento_pendente", "parcial"]);

  if ((orfasCassino ?? []).length > 0) {
    const { data: visitasAbertas } = await supabase
      .from("visitas")
      .select(
        "id, valor_operacao_efetivo, valor_operacao, valor_pago, restante, debito_abatido, saldo_negativo"
      )
      .eq("empresa_id", empresaId)
      .eq("ponto_id", pontoId)
      .eq("saldo_negativo", false);

    for (const p of orfasCassino ?? []) {
      const desc = `${p.titulo ?? ""} ${p.descricao ?? ""}`;
      const tipicaColeta =
        desc.includes("Dívida da operação") ||
        desc.includes("Pagamento pendente da coleta");
      if (!tipicaColeta) continue;

      const valor = Number(p.valor ?? 0);
      const aindaTemVisita = (visitasAbertas ?? []).some(
        (v) => Math.abs(cobravelCassinoVisita(v) - valor) <= 0.02
      );
      if (aindaTemVisita) continue;

      await supabase
        .from("pendencias")
        .delete()
        .eq("id", p.id)
        .eq("empresa_id", empresaId);
      ajustadas++;
    }
  }

  // 3) Órfãs (sem coleta_id/visita_id): só LIMITA o valor ao que ainda falta
  //    nas coletas. NÃO zera automaticamente — zerar órfãs apagava dívida real
  //    (visita_consolidada / parcial) e deixava o cassino “desregulado”.
  const { data: coletas } = await supabase
    .from("coletas")
    .select("valor_a_receber, valor_pago_recebido")
    .eq("empresa_id", empresaId)
    .eq("ponto_id", pontoId);

  const unpaidColetas = round2(
    (coletas ?? []).reduce((s, c) => s + saldoPendenteColeta(c), 0)
  );

  const { data: orfas } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, coleta_id, visita_id")
    .eq("empresa_id", empresaId)
    .eq("ponto_id", pontoId)
    .eq("status", "aberta")
    .order("created_at", { ascending: true });

  const orfasLista = (orfas ?? []).filter((p) => {
    if (p.coleta_id || p.visita_id) return false;
    const tipo = (p.tipo ?? "").toLowerCase();
    return (TIPOS_COBRANCA as readonly string[]).includes(tipo) || tipo.includes("consolidada");
  });

  const jaEspelhado = round2(
    (orfas ?? [])
      .filter((p) => p.coleta_id)
      .reduce((s, p) => s + Math.max(0, Number(p.valor ?? 0)), 0)
  );

  let alvoOrfas = round2(Math.max(0, unpaidColetas - jaEspelhado));

  for (const p of orfasLista) {
    const atual = round2(Math.max(0, Number(p.valor ?? 0)));
    if (alvoOrfas <= 0.009) {
      // Mantém órfã aberta — operador resolve/baixa no fluxo normal.
      continue;
    }

    const novo = round2(Math.min(atual, alvoOrfas));
    alvoOrfas = round2(alvoOrfas - novo);

    if (novo > 0.009 && Math.abs(atual - novo) > 0.019) {
      await supabase
        .from("pendencias")
        .update({ valor: novo })
        .eq("id", p.id)
        .eq("empresa_id", empresaId);
      ajustadas++;
    }
  }

  return { ajustadas };
}

/** Após pagar uma coleta, espelha o saldo na pendência ligada. */
export async function sincronizarPendenciaDaColeta(
  supabase: SupabaseClient,
  opts: { empresaId: string; coletaId: string }
): Promise<void> {
  const { data: coleta } = await supabase
    .from("coletas")
    .select("valor_a_receber, valor_pago_recebido, ponto_id")
    .eq("id", opts.coletaId)
    .eq("empresa_id", opts.empresaId)
    .maybeSingle();

  if (!coleta) return;
  const saldo = saldoPendenteColeta(coleta);
  const agora = new Date().toISOString();

  if (saldo <= 0.009) {
    await supabase
      .from("pendencias")
      .update({ status: "resolvida", valor: 0, resolvido_em: agora })
      .eq("empresa_id", opts.empresaId)
      .eq("coleta_id", opts.coletaId)
      .eq("status", "aberta");
  } else {
    await supabase
      .from("pendencias")
      .update({ valor: saldo })
      .eq("empresa_id", opts.empresaId)
      .eq("coleta_id", opts.coletaId)
      .eq("status", "aberta");
  }

  if (coleta.ponto_id) {
    await reconciliarPendenciasCobraveisPonto(supabase, {
      empresaId: opts.empresaId,
      pontoId: coleta.ponto_id,
    });
  }
}
