import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveFormaPagamento, formatPagamentoDetalhe } from "@/lib/financeiro/forma-pagamento";

const TITULO_HAVER = "Haver do ponto (diversão)";

export async function registrarHaverDiversao(
  supabase: SupabaseClient,
  opts: {
    empresaId: string;
    pontoId: string;
    pontoNome: string;
    coletaId?: string | null;
    valor: number;
    valorPix?: number;
    valorDinheiro?: number;
    motivo: string;
    operadorId?: string | null;
    registrarFinanceiro?: boolean;
  }
): Promise<void> {
  const valor = Math.round(opts.valor * 100) / 100;
  if (valor <= 0.009) return;

  const dataStr = new Date().toLocaleDateString("pt-BR");
  const linha = `${opts.motivo} em ${dataStr}: R$ ${valor.toFixed(2).replace(".", ",")}`;

  const { data: existente } = await supabase
    .from("pendencias")
    .select("id, valor, descricao")
    .eq("empresa_id", opts.empresaId)
    .eq("ponto_id", opts.pontoId)
    .eq("status", "aberta")
    .ilike("tipo", "haver")
    .ilike("titulo", "%diversão%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("pendencias")
      .update({
        valor: Math.round((Number(existente.valor) + valor) * 100) / 100,
        descricao: existente.descricao ? `${existente.descricao}\n${linha}` : linha,
      })
      .eq("id", existente.id);
  } else {
    await supabase.from("pendencias").insert({
      empresa_id: opts.empresaId,
      ponto_id: opts.pontoId,
      coleta_id: opts.coletaId ?? null,
      tipo: "haver",
      titulo: TITULO_HAVER,
      descricao: linha,
      valor,
      status: "aberta",
      prioridade: "baixa",
    });
  }

  if (opts.registrarFinanceiro) {
    const pix = Math.max(0, opts.valorPix ?? 0);
    const dinheiro = Math.max(0, opts.valorDinheiro ?? 0);
    const detalhe = formatPagamentoDetalhe(pix, dinheiro);
    await supabase.from("financeiro").insert({
      empresa_id: opts.empresaId,
      tipo: "entrada",
      categoria: "Haver diversão",
      valor,
      descricao: detalhe ? `Haver ${opts.pontoNome} — ${detalhe}` : `Haver ${opts.pontoNome}`,
      forma_pagamento: deriveFormaPagamento(pix, dinheiro),
      ponto_id: opts.pontoId,
      coleta_id: opts.coletaId ?? null,
      operador_id: opts.operadorId ?? null,
    });
  }
}
