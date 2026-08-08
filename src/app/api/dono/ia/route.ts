import { NextResponse } from "next/server";
import { getDonoSession } from "@/lib/dono/session";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { buildDonoCommand, serializarContextoDono } from "@/lib/dono/command";
import { chatCompletion, iaDisponivel } from "@/lib/ia/openai-client";

export async function GET() {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.json({ ia_disponivel: iaDisponivel() });
}

export async function POST(request: Request) {
  const session = await getDonoSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Admin não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const modo = String(body.modo ?? "briefing");
  const pergunta = String(body.pergunta ?? "").trim();

  const cmd = await buildDonoCommand();
  const contexto = serializarContextoDono(cmd);

  const prompts: Record<string, string> = {
    briefing:
      "Faça um briefing executivo do SaaS OperaRoute para o dono: saúde do funil, receita estimada, riscos de churn, fila de suporte e 5 ações prioritárias desta semana. Seja direto, em português, com bullets.",
    conversoes:
      "Analise conversão do funil (visitas → cadastro → onboarding → trial → ativo). Identifique gargalos e proponha experimentos concretos (copy, onboarding, pricing, follow-up). Português.",
    aceitacoes:
      "Foque em trials acabando/expirados e contas em risco. Para cada perfil de risco, sugira mensagem de aceitação/upgrade e critério (estender trial vs ativar assinatura vs reengajar). Português.",
    suporte:
      "Com base na fila de suporte e métricas, sugira como priorizar tickets e o que a IA do produto deveria melhorar para reduzir escalonamento humano. Português.",
    livre:
      pergunta ||
      "Resuma o estado do negócio e o que eu deveria fazer agora como dono do OperaRoute.",
  };

  let instrucao = prompts[modo] ?? prompts.briefing!;
  if (pergunta && modo !== "livre") {
    instrucao = `${instrucao}\n\nContexto / pergunta adicional do dono:\n${pergunta}`;
  }

  const result = await chatCompletion(
    [
      {
        role: "system",
        content:
          "Você é o copiloto estratégico do fundador do OperaRoute (SaaS B2B de operação de campo). Fale como advisor de growth/CS de SaaS de escala: claro, acionável, sem enrolação. Use os dados fornecidos; se faltar dado, diga o que instrumentar.",
      },
      {
        role: "user",
        content: `Dados atuais do painel:\n${contexto}\n\nPedido:\n${instrucao}`,
      },
    ],
    { maxTokens: 1800, temperature: 0.35 }
  );

  if (!result.ok) {
    // fallback heurístico local
    const local = [
      `## Briefing local (sem OpenAI: ${result.message})`,
      ``,
      `- MRR estimado: R$ ${Math.round(cmd.overview.mrr_estimado).toLocaleString("pt-BR")}`,
      `- Clientes: ${cmd.overview.total_empresas} · Ativos: ${cmd.overview.ativos} · Trials: ${cmd.overview.trials}`,
      `- Conversão onboarding: ${cmd.funil.taxa_conversao_onboarding_pct}% (${cmd.funil.nao_converteram_onboarding} incompletos)`,
      `- Suporte humano aberto: ${cmd.suporte.humano_aberto}`,
      `- Sessões nas últimas 24h: ${cmd.atividade.sessoes_24h}`,
      ``,
      `### Ações sugeridas`,
      ...cmd.acoes_sugeridas.map((a) => `- **${a.titulo}**: ${a.motivo}`),
    ].join("\n");

    return NextResponse.json({
      texto: local,
      modelo: "heuristica-local",
      ia_disponivel: false,
    });
  }

  return NextResponse.json({
    texto: result.text,
    modelo: result.model,
    ia_disponivel: true,
  });
}
