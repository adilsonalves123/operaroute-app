import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Restaura haver (e outras baixas) que uma coleta de nicho consumiu.
 * Linhas modernas: `Abatido R$ X em DATE [coleta:uuid]`
 * Fallback: `Abatido R$ X em DATE` no dia da coleta.
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
  const tag = `[coleta:${opts.coletaId}]`;

  const { data: pendencias } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, descricao, status")
    .eq("empresa_id", opts.empresaId)
    .eq("ponto_id", opts.pontoId);

  let restauradas = 0;

  for (const p of pendencias ?? []) {
    if (!p.descricao) continue;
    const tipo = (p.tipo ?? "").toLowerCase();
    // Haver e dívidas de operação de outros nichos
    if (
      tipo !== "haver" &&
      tipo !== "pagamento_pendente" &&
      tipo !== "parcial" &&
      tipo !== "visita_consolidada"
    ) {
      continue;
    }

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

    restauradas++;
  }

  return { restauradas };
}
