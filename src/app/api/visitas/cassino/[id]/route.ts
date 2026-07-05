import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { saldoPendenciaReais } from "@/lib/nichos/cassino/pendencias";

const ABATIDO_LINE_REGEX = /Abatido R\$ ([\d.,]+)/;
const BAIXA_LINE_REGEX = /Baixa de R\$ ([\d.,]+)/;

function parseValorBR(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

function valorAbatimentoLinha(linha: string): number {
  const match = linha.match(ABATIDO_LINE_REGEX) ?? linha.match(BAIXA_LINE_REGEX);
  return match ? parseValorBR(match[1]) : 0;
}

function isOperacaoTipo(tipo: string): boolean {
  const t = tipo.toLowerCase();
  return t === "pagamento_pendente" || t === "parcial";
}

function reverterPendenciaPelaVisita(
  pendencia: { tipo: string; valor: number | null; descricao: string | null },
  visitaId: string,
  dataVisita: Date,
  debitoAbatidoFallback: number
): {
  valor: number;
  descricao: string | null;
  status: string;
  resolvido_em: string | null;
  fallbackRestante: number;
} | null {
  if (!pendencia.descricao) return null;

  const dataStr = dataVisita.toLocaleDateString("pt-BR");
  let fallbackRestante = debitoAbatidoFallback;
  let removido = 0;
  const manter: string[] = [];

  for (const linha of pendencia.descricao.split("\n")) {
    const marcada = linha.includes(`[visita:${visitaId}]`);
    const temAbatimento =
      ABATIDO_LINE_REGEX.test(linha) || BAIXA_LINE_REGEX.test(linha);
    const fallback =
      !marcada &&
      fallbackRestante > 0.009 &&
      temAbatimento &&
      linha.includes(`na coleta de ${dataStr}`);

    if (!marcada && !fallback) {
      const limpa = linha.replace(` [visita:${visitaId}]`, "").trimEnd();
      if (limpa) manter.push(limpa);
      continue;
    }

    const v = valorAbatimentoLinha(linha);
    if (v <= 0.009) {
      const limpa = linha.replace(` [visita:${visitaId}]`, "").trimEnd();
      if (limpa) manter.push(limpa);
      continue;
    }

    if (fallback && removido + v - fallbackRestante > 0.009) {
      manter.push(linha.replace(` [visita:${visitaId}]`, "").trimEnd());
      continue;
    }

    removido += v;
    if (fallback) fallbackRestante = Math.max(0, fallbackRestante - v);
  }

  if (removido <= 0.009) return null;

  const novaDescricao = manter.join("\n").trim() || null;
  const novoValor = isOperacaoTipo(pendencia.tipo)
    ? Number(pendencia.valor ?? 0) + removido
    : Number(pendencia.valor ?? 0);

  const tipo = pendencia.tipo.toLowerCase();
  let status = "aberta";

  if (isOperacaoTipo(pendencia.tipo)) {
    status = novoValor > 0.009 ? "aberta" : "resolvida";
  } else if (tipo === "negativo" || tipo === "haver") {
    status =
      saldoPendenciaReais({
        id: "",
        valor: novoValor,
        observacao: novaDescricao,
      }) > 0.009
        ? "aberta"
        : "resolvida";
  }

  return {
    valor: novoValor,
    descricao: novaDescricao,
    status,
    resolvido_em: status === "aberta" ? null : null,
    fallbackRestante,
  };
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

  const { data: visita, error: visitaError } = await supabase
    .from("visitas")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (visitaError) {
    return NextResponse.json({ error: visitaError.message }, { status: 500 });
  }

  if (!visita) {
    return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });
  }

  const { data: coletas, error: coletasError } = await supabase
    .from("coletas")
    .select("id, equipamento_id, entrada_anterior, saida_anterior, created_at")
    .eq("visita_id", id)
    .eq("empresa_id", profile.empresa_id);

  if (coletasError) {
    return NextResponse.json({ error: coletasError.message }, { status: 500 });
  }

  const equipamentoIds = [...new Set((coletas ?? []).map((c) => c.equipamento_id).filter(Boolean))];

  if (equipamentoIds.length > 0) {
    const { data: coletaMaisNova } = await supabase
      .from("coletas")
      .select("id")
      .in("equipamento_id", equipamentoIds)
      .eq("empresa_id", profile.empresa_id)
      .gt("created_at", visita.created_at)
      .neq("visita_id", id)
      .limit(1)
      .maybeSingle();

    if (coletaMaisNova) {
      return NextResponse.json(
        {
          error:
            "Não é possível excluir esta coleta porque existe coleta mais nova para uma das máquinas. Exclua primeiro a coleta mais recente.",
        },
        { status: 409 }
      );
    }
  }

  for (const coleta of coletas ?? []) {
    if (!coleta.equipamento_id) continue;
    await supabase
      .from("equipamentos")
      .update({
        numero_entrada: coleta.entrada_anterior,
        numero_saida: coleta.saida_anterior,
      })
      .eq("id", coleta.equipamento_id)
      .eq("empresa_id", profile.empresa_id);
  }

  await supabase
    .from("financeiro")
    .delete()
    .eq("visita_id", id)
    .eq("empresa_id", profile.empresa_id);

  await supabase
    .from("pendencias")
    .delete()
    .eq("visita_id", id)
    .eq("empresa_id", profile.empresa_id);

  const debitoAbatido = Number(visita.debito_abatido ?? 0);
  const { data: pendenciasPonto } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, descricao")
    .eq("empresa_id", profile.empresa_id)
    .eq("ponto_id", visita.ponto_id);

  let fallbackRestante = debitoAbatido;
  const dataVisita = new Date(visita.created_at);

  for (const pendencia of pendenciasPonto ?? []) {
    const rollback = reverterPendenciaPelaVisita(
      pendencia,
      id,
      dataVisita,
      fallbackRestante
    );

    if (!rollback) continue;

    fallbackRestante = rollback.fallbackRestante;

    await supabase
      .from("pendencias")
      .update({
        valor: rollback.valor,
        descricao: rollback.descricao,
        status: rollback.status,
        resolvido_em: rollback.resolvido_em,
      })
      .eq("id", pendencia.id)
      .eq("empresa_id", profile.empresa_id);
  }

  const { error: deleteError } = await supabase
    .from("visitas")
    .delete()
    .eq("id", id)
    .eq("empresa_id", profile.empresa_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { data: visitaAnterior } = await supabase
    .from("visitas")
    .select("created_at")
    .eq("ponto_id", visita.ponto_id)
    .eq("empresa_id", profile.empresa_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("pontos")
    .update({ ultima_coleta: visitaAnterior?.created_at ?? null })
    .eq("id", visita.ponto_id)
    .eq("empresa_id", profile.empresa_id);

  return NextResponse.json({ success: true });
}
