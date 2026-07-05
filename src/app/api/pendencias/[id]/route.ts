import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { parseMoneyInput } from "@/lib/utils";
import type { FormaPagamento } from "@/lib/types/database";

function deriveFormaPagamento(pix: number, dinheiro: number): FormaPagamento {
  if (pix > 0 && dinheiro > 0) return "misto";
  if (pix > 0) return "pix";
  return "dinheiro";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const supabase = await createClient();

  const { data: pendencia, error: fetchError } = await supabase
    .from("pendencias")
    .select("valor, descricao, tipo, titulo, ponto_id")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pendencia) {
    return NextResponse.json({ error: "Pendência não encontrada" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const valorAtual = Number(pendencia.valor ?? 0);
  const observacao = String(body.observacao ?? "").trim();
  const dataStr = new Date().toLocaleDateString("pt-BR");
  let baixaFinanceira: {
    valor: number;
    pix: number;
    dinheiro: number;
    descricao: string;
  } | null = null;

  if (body.action === "baixa") {
    const valorPix = parseMoneyInput(body.valor_pix);
    const valorDinheiro = parseMoneyInput(body.valor_dinheiro);
    const valorPago = valorPix + valorDinheiro;
    if (!Number.isFinite(valorPago) || valorPago <= 0) {
      return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
    }

    const baixa = Math.min(valorPago, valorAtual);
    const restante = Math.max(0, valorAtual - baixa);
    const linha = `Baixa de R$ ${baixa.toFixed(2).replace(".", ",")} em ${dataStr}${
      observacao ? ` - ${observacao}` : ""
    }`;

    updates.valor = restante;
    updates.descricao = pendencia.descricao ? `${pendencia.descricao}\n${linha}` : linha;
    baixaFinanceira = {
      valor: baixa,
      pix: valorPix,
      dinheiro: valorDinheiro,
      descricao: `Baixa pendência - ${pendencia.titulo}`,
    };

    if (restante <= 0.009) {
      updates.status = "resolvida";
      updates.resolvido_em = new Date().toISOString();
    }
  } else if (body.action === "compensada") {
    const linha =
      observacao ||
      `Compensada na coleta negativa de ${dataStr} (abatimento automático)`;
    updates.status = "resolvida";
    updates.valor = 0;
    updates.resolvido_em = new Date().toISOString();
    updates.descricao = pendencia.descricao ? `${pendencia.descricao}\n${linha}` : linha;
  } else if (body.action === "quitar" || body.status === "resolvida") {
    const valorPix = parseMoneyInput(body.valor_pix);
    const valorDinheiro = parseMoneyInput(body.valor_dinheiro);
    const valorPago = valorPix + valorDinheiro;
    const baixa = Math.min(valorPago || valorAtual, valorAtual);
    const linha = `Quitado em ${dataStr}${observacao ? ` - ${observacao}` : ""}`;
    updates.status = "resolvida";
    updates.resolvido_em = new Date().toISOString();
    updates.descricao = pendencia.descricao ? `${pendencia.descricao}\n${linha}` : linha;
    if (valorPago > 0) {
      baixaFinanceira = {
        valor: baixa,
        pix: valorPix,
        dinheiro: valorDinheiro,
        descricao: `Quitação pendência - ${pendencia.titulo}`,
      };
    }
  }

  const { error } = await supabase
    .from("pendencias")
    .update(updates)
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (baixaFinanceira && baixaFinanceira.valor > 0) {
    const forma = deriveFormaPagamento(baixaFinanceira.pix, baixaFinanceira.dinheiro);
    const pixDetalhe =
      baixaFinanceira.pix > 0
        ? `Pix R$ ${baixaFinanceira.pix.toFixed(2).replace(".", ",")}`
        : "";
    const dinheiroDetalhe =
      baixaFinanceira.dinheiro > 0
        ? `Dinheiro R$ ${baixaFinanceira.dinheiro.toFixed(2).replace(".", ",")}`
        : "";
    const pagamentoDetalhe = [pixDetalhe, dinheiroDetalhe].filter(Boolean).join(" · ");

    await supabase.from("financeiro").insert({
      empresa_id: profile.empresa_id,
      tipo: pendencia.tipo === "haver" ? "saida" : "entrada",
      categoria: pendencia.tipo === "haver" ? "Uso de haver" : "Baixa de pendência",
      valor: baixaFinanceira.valor,
      descricao: pagamentoDetalhe
        ? `${baixaFinanceira.descricao} (${pagamentoDetalhe})`
        : baixaFinanceira.descricao,
      forma_pagamento: forma,
      ponto_id: pendencia.ponto_id,
      operador_id: profile.user_id,
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile?.empresa_id) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pendencias")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
