import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export async function POST(request: Request) {
  const { pergunta } = await request.json();
  const profile = await getProfile();

  if (!profile?.empresa_id) {
    return NextResponse.json({ resposta: "Faça login para usar a IA." });
  }

  const supabase = await createClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: coletas },
    { data: pontos },
    { count: pendencias },
    { data: estoque },
  ] = await Promise.all([
    supabase.from("coletas").select("valor_bruto, valor_liquido, ponto_id").eq("empresa_id", profile.empresa_id).gte("created_at", startOfMonth),
    supabase.from("pontos").select("*").eq("empresa_id", profile.empresa_id),
    supabase.from("pendencias").select("*", { count: "exact", head: true }).eq("empresa_id", profile.empresa_id).eq("status", "aberta"),
    supabase.from("estoque").select("*").eq("empresa_id", profile.empresa_id),
  ]);

  const totalBruto = coletas?.reduce((s, c) => s + Number(c.valor_bruto), 0) ?? 0;
  const totalLiquido = coletas?.reduce((s, c) => s + Number(c.valor_liquido), 0) ?? 0;

  const ranking = new Map<string, number>();
  coletas?.forEach((c) => {
    if (c.ponto_id) ranking.set(c.ponto_id, (ranking.get(c.ponto_id) ?? 0) + Number(c.valor_bruto));
  });

  const topPonto = [...ranking.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPontoNome = topPonto ? pontos?.find((p) => p.id === topPonto[0])?.nome : null;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pontosSemColeta = pontos?.filter((p) => !p.ultima_coleta || new Date(p.ultima_coleta) < sevenDaysAgo) ?? [];
  const estoqueBaixo = estoque?.filter((e) => e.quantidade <= e.quantidade_minima) ?? [];

  const q = pergunta.toLowerCase();
  let resposta = "";

  if (q.includes("faturou") || q.includes("melhor ponto")) {
    resposta = topPontoNome
      ? `O ponto que mais faturou este mês foi **${topPontoNome}** com ${formatCurrency(topPonto[1])}.`
      : "Ainda não há coletas registradas este mês para calcular o ranking.";
  } else if (q.includes("perdendo") || q.includes("prejuízo")) {
    const inativos = pontos?.filter((p) => p.status !== "ativo").length ?? 0;
    resposta = `Análise rápida:\n• ${pontosSemColeta.length} pontos sem coleta há +7 dias\n• ${pendencias ?? 0} pendências abertas\n• ${inativos} pontos inativos/pausados\n\nPriorize visitar pontos sem coleta e resolver pendências urgentes.`;
  } else if (q.includes("visitar") || q.includes("hoje")) {
    resposta = pontosSemColeta.length > 0
      ? `Pontos que precisam de visita:\n${pontosSemColeta.slice(0, 5).map((p) => `• ${p.nome} (${p.cidade ?? "sem cidade"})`).join("\n")}`
      : "Todos os pontos foram visitados recentemente. Ótimo trabalho!";
  } else if (q.includes("estoque")) {
    resposta = estoqueBaixo.length > 0
      ? `Atenção! ${estoqueBaixo.length} itens com estoque baixo:\n${estoqueBaixo.map((e) => `• ${e.nome_item}: ${e.quantidade} un (mín: ${e.quantidade_minima})`).join("\n")}`
      : `Estoque OK! ${estoque?.length ?? 0} itens cadastrados, nenhum abaixo do mínimo.`;
  } else if (q.includes("resumo") || q.includes("mês")) {
    resposta = `📊 Resumo do mês — ${profile.nome_operacao ?? "Sua operação"}\n\n• Total bruto: ${formatCurrency(totalBruto)}\n• Lucro estimado: ${formatCurrency(totalLiquido)}\n• Coletas: ${coletas?.length ?? 0}\n• Pontos ativos: ${pontos?.filter((p) => p.status === "ativo").length ?? 0}\n• Pendências: ${pendencias ?? 0}\n\n${topPontoNome ? `Melhor ponto: ${topPontoNome}` : ""}`;
  } else if (q.includes("melhorar")) {
    resposta = `Sugestões para melhorar:\n1. Visite os ${pontosSemColeta.length} pontos sem coleta recente\n2. Resolva as ${pendencias ?? 0} pendências abertas\n3. ${estoqueBaixo.length > 0 ? "Reponha estoque baixo" : "Mantenha o estoque atualizado"}\n4. Analise pontos com baixo faturamento no ranking`;
  } else {
    resposta = `Com base nos dados da operação:\n• Faturamento do mês: ${formatCurrency(totalBruto)}\n• Lucro: ${formatCurrency(totalLiquido)}\n• ${coletas?.length ?? 0} coletas realizadas\n• ${pendencias ?? 0} pendências abertas\n\nFaça perguntas específicas como "qual ponto mais faturou?" ou "me faça um resumo do mês".`;
  }

  return NextResponse.json({ resposta: resposta.replace(/\*\*/g, "") });
}
