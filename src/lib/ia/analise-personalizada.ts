import { formatCurrency } from "@/lib/utils";
import { centesimosToReais } from "@/lib/nichos/cassino/contadores";
import { chatCompletion } from "./openai-client";
import {
  serializarContextoParaPrompt,
  SYSTEM_PROMPT_IA_OPERACIONAL,
  type ContextoIAPersonalizada,
} from "./contexto-operacional";

export type AnalisePersonalizadaResult = {
  texto: string;
  fonte: "openai" | "local";
  modelo?: string;
  aviso?: string;
};

function secaoCassino(ctx: ContextoIAPersonalizada): string[] {
  const linhas: string[] = [];
  const c = ctx.cassino;
  if (!c) return linhas;

  linhas.push("CASSINO E URSO/PELÚCIA");
  linhas.push(
    `• Lucro ${formatCurrency(c.lucro)} · entrada ${formatCurrency(centesimosToReais(c.entrada))} · saída ${formatCurrency(centesimosToReais(c.saida))} · ${c.visitas} visita(s)`
  );

  if (c.rankingMaquinas.length > 0) {
    linhas.push("");
    linhas.push("Máquinas com mais entrada (volume jogado):");
    [...c.rankingMaquinas]
      .sort((a, b) => b.entrada - a.entrada)
      .slice(0, 5)
      .forEach((m, i) => {
        const tipo =
          m.tipo === "vending_ursinho" ? "urso" : m.tipo === "cassino" ? "cassino" : "máquina";
        linhas.push(
          `${i + 1}. ${m.nome} (${tipo}) · ${m.pontoNome}: entrada ${formatCurrency(centesimosToReais(m.entrada))}` +
            (m.pctPago != null ? ` · paga ${m.pctPago.toFixed(1)}%` : "") +
            ` · lucro ${formatCurrency(m.lucro)}`
        );
      });

    linhas.push("");
    linhas.push("Máquinas com mais saída (pagamento):");
    [...c.rankingMaquinas]
      .sort((a, b) => b.saida - a.saida)
      .slice(0, 5)
      .forEach((m, i) => {
        linhas.push(
          `${i + 1}. ${m.nome} · ${m.pontoNome}: saída ${formatCurrency(centesimosToReais(m.saida))}`
        );
      });
  }

  const urso = c.rankingMaquinas.filter((m) => m.tipo === "vending_ursinho");
  if (urso.length > 0) {
    linhas.push("");
    linhas.push("Pontos urso/pelúcia (por lucro):");
    const porPonto = new Map<string, { lucro: number; entrada: number }>();
    for (const m of urso) {
      const prev = porPonto.get(m.pontoNome) ?? { lucro: 0, entrada: 0 };
      prev.lucro += m.lucro;
      prev.entrada += m.entrada;
      porPonto.set(m.pontoNome, prev);
    }
    [...porPonto.entries()]
      .sort((a, b) => b[1].lucro - a[1].lucro)
      .slice(0, 5)
      .forEach(([nome, stats], i) => {
        linhas.push(
          `${i + 1}. ${nome}: lucro ${formatCurrency(stats.lucro)} · entrada ${formatCurrency(centesimosToReais(stats.entrada))}`
        );
      });
  }

  if (c.saudePontos.length > 0) {
    linhas.push("");
    linhas.push("Frequência de visita no período (pontos cassino/urso):");
    const comVisita = c.saudePontos.filter((p) => p.visitas > 0);
    const semVisita = c.saudePontos.filter((p) => p.visitas === 0);
    comVisita.slice(0, 5).forEach((p) => {
      linhas.push(`• ${p.nome}: ${p.visitas} visita(s) · lucro ${formatCurrency(p.lucroMes)}`);
    });
    if (semVisita.length > 0) {
      linhas.push(`• ${semVisita.length} ponto(s) sem visita no período — avaliar se compensa incluir na rota.`);
    }
  }

  return linhas;
}

function secaoFuraFura(ctx: ContextoIAPersonalizada): string[] {
  const linhas: string[] = [];
  const ff = ctx.furaFura;
  if (!ff) return linhas;

  linhas.push("FURA-FURA");
  linhas.push(
    `• ${ff.totalFuros} furos em ${ff.coletas} coleta(s) · lucro livre ${formatCurrency(ff.caixa.lucroLivre)}`
  );

  if (ff.rankingKits.length > 0) {
    linhas.push("");
    linhas.push("Kits por furos (métrica principal):");
    ff.rankingKits.slice(0, 5).forEach((k, i) => {
      linhas.push(
        `${i + 1}. ${k.kitNome}: ${k.totalFuros} furos (${k.mediaFurosPorColeta.toFixed(1)}/coleta)` +
          (k.ratioBrindesPorFuro != null ? ` · ${k.ratioBrindesPorFuro.toFixed(2)} brindes/furo` : "")
      );
    });
  }

  if (ff.alertasBrindeKit.length > 0) {
    linhas.push("");
    linhas.push("Alertas (brindes acima do normal):");
    ff.alertasBrindeKit.slice(0, 4).forEach((a) => {
      linhas.push(`• ${a.pontoNome} (${a.kitNome ?? "kit"}): +${a.desvioPct.toFixed(0)}% vs média`);
    });
  }

  return linhas;
}

function secaoUrsinho(ctx: ContextoIAPersonalizada): string[] {
  const linhas: string[] = [];
  const u = ctx.ursinho;
  if (!u) return linhas;

  linhas.push("URSINHO");
  linhas.push(
    `• ${u.coletas} coleta(s) · ${u.totalMaquinas} máquina(s) · lucro livre ${formatCurrency(u.caixa.lucroLivre)}`
  );
  linhas.push(
    `• Entrada R$ ${u.caixa.brutoMaquina.toFixed(2)} · caixa operação R$ ${u.caixa.dinheiroOperacao.toFixed(2)} · brindes R$ ${u.caixa.reservaBrindes.toFixed(2)}`
  );
  if (u.rankingPontos[0] && u.rankingPontos[0].lucro > 0.009) {
    linhas.push(
      `• Melhor ponto: ${u.rankingPontos[0].nome} (${formatCurrency(u.rankingPontos[0].lucro)})`
    );
  }
  return linhas;
}

function analiseLocalBriefing(ctx: ContextoIAPersonalizada): string {
  const linhas: string[] = [];
  linhas.push(`Análise personalizada — ${ctx.periodoLabel}`);
  linhas.push(`Operação: ${ctx.nomeOperacao}`);
  linhas.push("");

  const nichos: string[] = [];
  if (ctx.nichos.furaFura) nichos.push("fura-fura");
  if (ctx.nichos.cassino) nichos.push("cassino");
  if (ctx.nichos.ursinho) nichos.push("ursinho");
  if (nichos.length > 0) {
    linhas.push(`Nichos ativos: ${nichos.join(", ")}`);
    linhas.push("");
  }

  linhas.push(
    `Lucro líquido (recebido): ${formatCurrency(ctx.visao.liquidoOperacao ?? ctx.visao.lucroLiquido)}`
  );
  if (ctx.comparativo) {
    const d = ctx.comparativo.liquidoOperacaoDelta;
    linhas.push(
      `Vs período anterior: ${d >= 0 ? "+" : ""}${formatCurrency(d)}${ctx.comparativo.liquidoOperacaoDeltaPct != null ? ` (${ctx.comparativo.liquidoOperacaoDeltaPct.toFixed(0)}%)` : ""}`
    );
  }
  linhas.push(
    `Entrada ${formatCurrency(ctx.visao.entrada ?? ctx.visao.faturamentoBruto)} · saída ${formatCurrency(ctx.visao.saida ?? 0)} · comissão ${formatCurrency(ctx.visao.comissao ?? 0)}`
  );
  linhas.push("");

  linhas.push(...secaoFuraFura(ctx));
  if (ctx.furaFura) linhas.push("");

  linhas.push(...secaoUrsinho(ctx));
  if (ctx.ursinho) linhas.push("");

  linhas.push(...secaoCassino(ctx));

  if (ctx.estoqueAbaixoMinimo.length > 0) {
    linhas.push("");
    linhas.push("Estoque central abaixo do mínimo:");
    ctx.estoqueAbaixoMinimo.slice(0, 5).forEach((e) => {
      linhas.push(`• ${e.nome}: ${e.quantidade} un. (mín. ${e.quantidadeMinima})`);
    });
  }

  if (ctx.pontosAtencao.length > 0) {
    linhas.push("");
    linhas.push("Pontos que merecem atenção:");
    ctx.pontosAtencao.slice(0, 5).forEach((p) => {
      linhas.push(`• ${p.nome}: ${p.motivos.join("; ")}`);
    });
  }

  linhas.push("");
  linhas.push(
    "— Análise gerada localmente. Configure OPENAI_API_KEY para respostas mais detalhadas em todos os nichos."
  );

  return linhas.join("\n");
}

function analiseLocalPergunta(ctx: ContextoIAPersonalizada, pergunta: string): string {
  const q = pergunta.toLowerCase();
  const c = ctx.cassino;

  if (
    c &&
    (q.includes("cassino") ||
      q.includes("máquina") ||
      q.includes("maquina") ||
      q.includes("entrada") ||
      q.includes("saída") ||
      q.includes("saida") ||
      q.includes("jogando") ||
      q.includes("jogo"))
  ) {
    if (c.rankingMaquinas.length === 0) {
      return "Sem leituras de máquinas no período. Registre visitas com contadores para comparar entrada, saída e lucro.";
    }
    if (q.includes("saída") || q.includes("saida") || q.includes("paga")) {
      const top = [...c.rankingMaquinas].sort((a, b) => b.saida - a.saida).slice(0, 5);
      return (
        "Máquinas com mais saída no período:\n" +
        top
          .map(
            (m, i) =>
              `${i + 1}. ${m.nome} (${m.pontoNome}): ${formatCurrency(centesimosToReais(m.saida))}` +
              (m.pctPago != null ? ` · ${m.pctPago.toFixed(1)}% pago` : "")
          )
          .join("\n")
      );
    }
    const top = [...c.rankingMaquinas].sort((a, b) => b.entrada - a.entrada).slice(0, 5);
    return (
      "Máquinas com mais entrada (volume) no período:\n" +
      top
        .map(
          (m, i) =>
            `${i + 1}. ${m.nome} (${m.pontoNome}): ${formatCurrency(centesimosToReais(m.entrada))} · lucro ${formatCurrency(m.lucro)}`
        )
        .join("\n")
    );
  }

  if (
    c &&
    (q.includes("urso") || q.includes("pelúcia") || q.includes("pelucia") || q.includes("vending"))
  ) {
    const urso = c.rankingMaquinas.filter((m) => m.tipo === "vending_ursinho");
    if (urso.length === 0) {
      return "Não há máquinas de urso/pelúcia com leitura no período.";
    }
    const porPonto = new Map<string, { lucro: number; entrada: number; maquinas: number }>();
    for (const m of urso) {
      const prev = porPonto.get(m.pontoNome) ?? { lucro: 0, entrada: 0, maquinas: 0 };
      prev.lucro += m.lucro;
      prev.entrada += m.entrada;
      prev.maquinas++;
      porPonto.set(m.pontoNome, prev);
    }
    const ranking = [...porPonto.entries()].sort((a, b) => b[1].lucro - a[1].lucro);
    return (
      "Pontos com urso/pelúcia (por lucro no período):\n" +
      ranking
        .slice(0, 6)
        .map(
          ([nome, s], i) =>
            `${i + 1}. ${nome}: lucro ${formatCurrency(s.lucro)} · ${s.maquinas} máq. · entrada ${formatCurrency(centesimosToReais(s.entrada))}`
        )
        .join("\n") +
      "\n\nPara frequência de visita (mensal vs bimestral), compare visitas no período com lucro — pontos fortes costumam exigir rota mais frequente."
    );
  }

  if (
    c &&
    (q.includes("visita") || q.includes("rota") || q.includes("mês") || q.includes("mes") || q.includes("frequên"))
  ) {
    const pontos = c.saudePontos;
    if (pontos.length === 0) {
      return "Sem dados de visitas no período. Registre visitas nos pontos para sugerir frequência de rota.";
    }
    const fortes = pontos.filter((p) => p.classe === "forte" || p.lucroMes > 100);
    const fracos = pontos.filter((p) => p.classe === "fraco" || p.visitas === 0);
    const linhas = ["Sugestão de frequência com base no período atual:"];
    fortes.slice(0, 4).forEach((p) => {
      linhas.push(`• ${p.nome}: priorizar visita mais frequente (${p.visitas} visita(s), lucro ${formatCurrency(p.lucroMes)})`);
    });
    fracos.slice(0, 4).forEach((p) => {
      linhas.push(`• ${p.nome}: pode espaçar visitas (${p.visitas} visita(s), lucro ${formatCurrency(p.lucroMes)})`);
    });
    return linhas.join("\n");
  }

  if (
    ctx.furaFura &&
    (q.includes("kit") ||
      q.includes("furo") ||
      q.includes("furador") ||
      q.includes("brinde"))
  ) {
    if (q.includes("furador") || (q.includes("brinde") && q.includes("normal"))) {
      const alertas = ctx.furaFura.alertasBrindeKit;
      if (alertas.length === 0) {
        return "Nenhum ponto com saída de brindes acima do normal no período.";
      }
      return (
        "Pontos com possível furador mal montado:\n" +
        alertas
          .slice(0, 5)
          .map((a) => `• ${a.pontoNome}: ${a.ratioAtual.toFixed(2)} brindes/furo (média ${a.ratioMedioKit.toFixed(2)})`)
          .join("\n")
      );
    }
    if (ctx.furaFura.rankingKits.length === 0) {
      return "Sem dados de kits no período. Cadastre kits, instale nos pontos e registre coletas.";
    }
    const ranking = ctx.furaFura.rankingKits;
    return (
      "Kits por furos:\n" +
      ranking
        .map((k, i) => `${i + 1}º ${k.kitNome}: ${k.totalFuros} furos`)
        .join("\n") +
      `\n\nO ${ranking[0].kitNome} lidera em jogadas no período.`
    );
  }

  if (q.includes("prioriz") || q.includes("onde") || q.includes("visitar")) {
    if (ctx.pontosAtencao.length > 0) {
      return (
        "Priorize estes pontos:\n" +
        ctx.pontosAtencao
          .slice(0, 6)
          .map((p) => `• ${p.nome} — ${p.motivos.join(", ")}`)
          .join("\n")
      );
    }
    return "Nenhum ponto crítico no radar. Mantenha a rota e monitore por nicho no Centro de Inteligência.";
  }

  return analiseLocalBriefing(ctx);
}

function montarPromptBriefing(ctx: ContextoIAPersonalizada): string {
  const partes: string[] = [
    `Gere um briefing executivo de ${ctx.periodoLabel} cobrindo os nichos ativos da operação.`,
  ];
  if (ctx.nichos.furaFura) {
    partes.push(
      "Fura-fura: kits por furos, alertas de brindes, pontos fracos e coletas pendentes."
    );
  }
  if (ctx.nichos.cassino) {
    partes.push(
      "Cassino e urso: máquinas com mais entrada e saída, % pago, melhores pontos, e sugestão de frequência de visita (mensal vs bimestral) com base nas visitas do período."
    );
  }
  partes.push("Estoque e capital se relevante. Ações práticas para os próximos dias.");
  return partes.join("\n");
}

export async function gerarAnalisePersonalizada(
  ctx: ContextoIAPersonalizada,
  opts?: { pergunta?: string; historico?: { role: "user" | "assistant"; content: string }[] }
): Promise<AnalisePersonalizadaResult> {
  const contextoJson = serializarContextoParaPrompt(ctx);
  const pergunta = opts?.pergunta?.trim();

  const userPrompt = pergunta
    ? `Dados da operação (JSON):\n${contextoJson}\n\nPergunta do operador:\n${pergunta}`
    : `Dados da operação (JSON):\n${contextoJson}\n\n${montarPromptBriefing(ctx)}`;

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT_IA_OPERACIONAL },
    ...(opts?.historico ?? []).slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userPrompt },
  ];

  const llm = await chatCompletion(messages);

  if (llm.ok) {
    return { texto: llm.text, fonte: "openai", modelo: llm.model };
  }

  const texto = pergunta
    ? analiseLocalPergunta(ctx, pergunta)
    : analiseLocalBriefing(ctx);

  const aviso =
    llm.reason === "no_key"
      ? "IA externa não configurada — exibindo análise local."
      : `IA indisponível (${llm.message}) — exibindo análise local.`;

  return { texto, fonte: "local", aviso };
}
