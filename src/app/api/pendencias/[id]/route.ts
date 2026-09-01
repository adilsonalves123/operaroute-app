import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { requireAcesso } from "@/lib/equipe/require-acesso";
import { extrairTotalAbatido } from "@/lib/nichos/cassino/pendencias";
import { parseMoneyInput } from "@/lib/utils";
import { baixarPendenciaVisitaPonto } from "@/lib/visitas-ponto/checkout";
import { sincronizarOrigemAposEdicaoPendencia } from "@/lib/visitas-ponto/sync-pendencia-edit";
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
    .select(
      "valor, descricao, tipo, titulo, ponto_id, status, visita_ponto_id, coleta_id, visita_id"
    )
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
  let syncAposEdicao: {
    novoSaldo: number;
    tipo: string;
    coletaId: string | null;
    visitaId: string | null;
  } | null = null;

  if (body.action === "baixa") {
    const valorPix = parseMoneyInput(body.valor_pix);
    const valorDinheiro = parseMoneyInput(body.valor_dinheiro);
    const valorPago = valorPix + valorDinheiro;
    if (!Number.isFinite(valorPago) || valorPago <= 0) {
      return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
    }

    if (pendencia.visita_ponto_id) {
      const { data: ponto } = await supabase
        .from("pontos")
        .select("nome")
        .eq("id", pendencia.ponto_id ?? "")
        .maybeSingle();

      try {
        const resultado = await baixarPendenciaVisitaPonto(supabase, {
          empresaId: profile.empresa_id,
          pendenciaId: id,
          visitaPontoId: pendencia.visita_ponto_id,
          pontoId: pendencia.ponto_id ?? "",
          pontoNome: ponto?.nome ?? "Ponto",
          valorPix,
          valorDinheiro,
          operadorId: profile.user_id,
          observacao: observacao || undefined,
        });

        const { auditarAcao } = await import("@/lib/auditoria/auditar");
        await auditarAcao(supabase, profile, {
          acao: "pendencia.baixa",
          tabela: "pendencias",
          registroId: id,
          dadosNovos: { valor_pix: valorPix, valor_dinheiro: valorDinheiro },
          severidade: "high",
          categoria: "financeiro",
          modulo: "pendencias",
          titulo: `Baixou pendência · ${ponto?.nome ?? "ponto"}`,
          resumo: `Pix R$ ${valorPix.toFixed(2)} · Dinheiro R$ ${valorDinheiro.toFixed(2)}`,
          request,
        });

        return NextResponse.json({ success: true, ...resultado });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Erro ao baixar pendência da visita." },
          { status: 400 }
        );
      }
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
  } else if (body.action === "editar") {
    const auth = await requireAcesso("pendencias", "editar");
    if (!auth.ok) return auth.response;

    const novoSaldo = parseMoneyInput(body.valor);
    if (!Number.isFinite(novoSaldo) || novoSaldo < 0) {
      return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
    }

    const titulo = String(body.titulo ?? pendencia.titulo ?? "").trim();
    if (!titulo) {
      return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
    }

    const tipoPendencia = String(pendencia.tipo ?? "").toLowerCase();
    const abatidoNegativo =
      tipoPendencia === "negativo" ? extrairTotalAbatido(pendencia.descricao) : 0;
    const novoValor = tipoPendencia === "negativo" ? novoSaldo + abatidoNegativo : novoSaldo;
    const saldoAnterior =
      tipoPendencia === "negativo"
        ? Math.max(0, valorAtual - abatidoNegativo)
        : valorAtual;

    const obsEdit = String(body.observacao_edit ?? "").trim();
    const linha = `Editado em ${dataStr}: saldo R$ ${saldoAnterior.toFixed(2).replace(".", ",")} → R$ ${novoSaldo.toFixed(2).replace(".", ",")}${obsEdit ? ` — ${obsEdit}` : ""}`;

    updates.valor = novoValor;
    updates.titulo = titulo;
    updates.descricao = pendencia.descricao ? `${pendencia.descricao}\n${linha}` : linha;

    if (pendencia.status === "resolvida" && novoSaldo > 0.009) {
      updates.status = "aberta";
      updates.resolvido_em = null;
    }

    syncAposEdicao = {
      novoSaldo,
      tipo: tipoPendencia,
      coletaId: pendencia.coleta_id ?? null,
      visitaId: pendencia.visita_id ?? null,
    };
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  }

  const { error } = await supabase
    .from("pendencias")
    .update(updates)
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (syncAposEdicao) {
    try {
      await sincronizarOrigemAposEdicaoPendencia(supabase, {
        empresaId: profile.empresa_id,
        coletaId: syncAposEdicao.coletaId,
        visitaId: syncAposEdicao.visitaId,
        novoSaldoCobravel: syncAposEdicao.novoSaldo,
        tipo: syncAposEdicao.tipo,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Pendência salva, mas falhou ao alinhar coleta/visita de origem.",
        },
        { status: 500 }
      );
    }
  }

  if (baixaFinanceira && baixaFinanceira.valor > 0) {
    const forma = deriveFormaPagamento(baixaFinanceira.pix, baixaFinanceira.dinheiro);
    let valorLancamento = baixaFinanceira.valor;
    let descricaoExtra = "";

    if (pendencia.tipo === "haver") {
      const { fetchSaldoCaixa, valorSaidaPermitidaNoCaixa } = await import(
        "@/lib/financeiro/saldo-caixa"
      );
      const saldo = await fetchSaldoCaixa(supabase, profile.empresa_id);
      valorLancamento = valorSaidaPermitidaNoCaixa(saldo, baixaFinanceira.valor);
      if (valorLancamento + 0.009 < baixaFinanceira.valor) {
        descricaoExtra = ` · caixa limitado a R$ ${valorLancamento.toFixed(2).replace(".", ",")}`;
      }
    }

    if (valorLancamento > 0.009) {
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
        valor: valorLancamento,
        descricao: pagamentoDetalhe
          ? `${baixaFinanceira.descricao} (${pagamentoDetalhe})${descricaoExtra}`
          : `${baixaFinanceira.descricao}${descricaoExtra}`,
        forma_pagamento: forma,
        ponto_id: pendencia.ponto_id,
        operador_id: profile.user_id,
      });
    }
  }

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "pendencia.atualizar",
    tabela: "pendencias",
    registroId: id,
    dadosAnteriores: {
      status: pendencia.status,
      valor: pendencia.valor,
      tipo: pendencia.tipo,
    },
    dadosNovos: body as Record<string, unknown>,
    severidade: "medium",
    categoria: "financeiro",
    modulo: "pendencias",
    titulo: `Atualizou pendência (${pendencia.tipo})`,
    resumo: `Ponto ${pendencia.ponto_id} · R$ ${Number(pendencia.valor ?? 0).toFixed(2)}`,
    request,
  });

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

  const { auditarAcao } = await import("@/lib/auditoria/auditar");
  await auditarAcao(supabase, profile, {
    acao: "pendencia.excluir",
    tabela: "pendencias",
    registroId: id,
    severidade: "high",
    categoria: "financeiro",
    modulo: "pendencias",
    titulo: "Apagou pendência",
    resumo: `Pendência ${id}`,
  });

  return NextResponse.json({ success: true });
}
