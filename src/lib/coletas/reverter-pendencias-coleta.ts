import type { SupabaseClient } from "@supabase/supabase-js";
import { cobravelCassinoVisita } from "@/lib/visitas-ponto/resumo";
import { tagColetaOrigem, tagViaColetaOrigem } from "@/lib/coletas/baixa-pendencia-coleta";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseValorBR(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

const ABATIDO_REGEX = /Abatido R\$ ([\d.,]+)/i;
const BAIXA_REGEX = /Baixa de R\$ ([\d.,]+)/i;
const COMPENSADO_REGEX = /Compensado R\$ ([\d.,]+)/i;

function valorLinha(linha: string): number {
  const m =
    linha.match(ABATIDO_REGEX) ??
    linha.match(BAIXA_REGEX) ??
    linha.match(COMPENSADO_REGEX);
  return m ? parseValorBR(m[1]) : 0;
}

function temBaixa(linha: string): boolean {
  return ABATIDO_REGEX.test(linha) || BAIXA_REGEX.test(linha) || COMPENSADO_REGEX.test(linha);
}

/**
 * Restaura haver e dívidas que uma coleta de nicho consumiu.
 * Linhas: `Baixa de R$ X em DATE [coleta:uuid]` / `Abatido R$ X …`
 * Também desfaz pagamento espelhado em coleta antiga ou visita cassino.
 */
export async function reverterPendenciasAfetadasPorColeta(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    coletaId: string;
    createdAt: string | Date;
  }
): Promise<{ restauradas: number }> {
  const dataStr = new Date(opts.createdAt).toLocaleDateString("pt-BR");
  const tag = tagColetaOrigem(opts.coletaId);
  const viaTag = tagViaColetaOrigem(opts.coletaId);

  const { data: pendencias } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, descricao, status, coleta_id, visita_id")
    .eq("empresa_id", opts.empresaId)
    .eq("ponto_id", opts.pontoId);

  let restauradas = 0;

  for (const p of pendencias ?? []) {
    if (!p.descricao) continue;

    let removido = 0;
    const manter: string[] = [];

    for (const linha of p.descricao.split("\n")) {
      const marcada = linha.includes(tag);
      const fallback =
        !marcada &&
        temBaixa(linha) &&
        (linha.includes(`em ${dataStr}`) || linha.includes(`na coleta de ${dataStr}`));

      if (!marcada && !fallback) {
        const limpa = linha.replace(` ${tag}`, "").trimEnd();
        if (limpa) manter.push(limpa);
        continue;
      }

      const v = valorLinha(linha);
      if (v <= 0.009) {
        const limpa = linha.replace(` ${tag}`, "").trimEnd();
        if (limpa) manter.push(limpa);
        continue;
      }
      removido = round2(removido + v);
    }

    if (removido <= 0.009) continue;

    const valorAtual = Number(p.valor ?? 0);
    const novoValor = round2(valorAtual + removido);
    const novaDescricao = manter.join("\n").trim() || null;
    const status = novoValor > 0.009 ? "aberta" : "resolvida";

    await supabase
      .from("pendencias")
      .update({
        valor: novoValor,
        descricao: novaDescricao,
        status,
        resolvido_em: status === "resolvida" ? new Date().toISOString() : null,
      })
      .eq("id", p.id)
      .eq("empresa_id", opts.empresaId);

    // Desfaz quitação espelhada na coleta antiga (FIFO).
    if (p.coleta_id) {
      const { data: col } = await supabase
        .from("coletas")
        .select("id, valor_pago_recebido, valor_a_receber")
        .eq("id", p.coleta_id)
        .eq("empresa_id", opts.empresaId)
        .maybeSingle();

      if (col) {
        const pagoAtual = Number(col.valor_pago_recebido ?? 0);
        const novoPago = round2(Math.max(0, pagoAtual - removido));
        await supabase
          .from("coletas")
          .update({ valor_pago_recebido: novoPago })
          .eq("id", col.id)
          .eq("empresa_id", opts.empresaId);

        const { data: pags } = await supabase
          .from("coleta_pagamentos")
          .select("id, observacao, valor")
          .eq("coleta_id", col.id)
          .eq("empresa_id", opts.empresaId);

        const viaIds = (pags ?? [])
          .filter((pg) => String(pg.observacao ?? "").includes(viaTag))
          .map((pg) => pg.id);
        if (viaIds.length > 0) {
          await supabase.from("coleta_pagamentos").delete().in("id", viaIds);
        }
      }
    }

    // Desfaz quitação espelhada em visita cassino (sem alterar rotas/UI do cassino).
    if (p.visita_id) {
      const { data: visita } = await supabase
        .from("visitas")
        .select(
          "id, valor_operacao_efetivo, valor_operacao, valor_pago, restante, debito_abatido, saldo_negativo"
        )
        .eq("id", p.visita_id)
        .eq("empresa_id", opts.empresaId)
        .maybeSingle();

      if (visita && !visita.saldo_negativo) {
        const pagoAtual = Number(visita.valor_pago ?? 0);
        const novoPago = round2(Math.max(0, pagoAtual - removido));
        const cobravel = cobravelCassinoVisita(visita);
        const novoRestante = round2(Math.max(0, cobravel - novoPago));
        await supabase
          .from("visitas")
          .update({
            valor_pago: novoPago,
            restante: novoRestante,
          })
          .eq("id", visita.id)
          .eq("empresa_id", opts.empresaId);
      }
    }

    restauradas++;
  }

  return { restauradas };
}
