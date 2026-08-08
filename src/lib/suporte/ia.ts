import { chatCompletion, type ChatMessage } from "@/lib/ia/openai-client";
import { ESCALAR_TOKEN } from "@/lib/suporte/types";

const SYSTEM_PROMPT = `Você é o assistente de suporte do OperaRoute — sistema de operação para máquinas (cassino, ursinho, bolinha, diversão, consignado, fura-fura).

Seu papel:
- Ajudar o cliente a usar o app: pontos, equipamentos, coletas, estoque, rotas, equipe, chamados de manutenção, análise, planos.
- Ser claro, direto e em português do Brasil.
- Não inventar dados financeiros ou leituras de máquina que você não tem.
- Não pedir senha, tokens ou chaves de API.
- Se a dúvida for operacional dos números da empresa dele, oriente a usar a "IA do Sistema" (/ia) ou Análise.
- Se não souber, se for cobrança/contrato/bug grave, ou se o cliente pedir pessoa, diga que vai encaminhar e termine a resposta com exatamente: ${ESCALAR_TOKEN}

Respostas curtas (até ~8 frases). Sem markdown excessivo.`;

export type RespostaSuporteIA = {
  texto: string;
  escalar: boolean;
  fonte: "openai" | "local";
};

function fallbackLocal(pergunta: string): RespostaSuporteIA {
  const p = pergunta.toLowerCase();

  if (/plano|assinatura|pagamento|cobran|pre[cç]o|mensalidade/.test(p)) {
    return {
      texto: `Sobre plano e cobrança eu não fecho sozinho — vou te passar para a equipe OperaRoute.\n\n${ESCALAR_TOKEN}`,
      escalar: true,
      fonte: "local",
    };
  }

  if (/bug|erro|travou|n[aã]o (abre|carrega|salva)|falha/.test(p)) {
    return {
      texto: `Entendi que algo pode estar falhando. Descreva a tela e o que tentou fazer; se continuar, encaminho para atendimento humano.\n\nEnquanto isso: atualize a página (F5) e confira se está no ponto/empresa certos.\n\n${ESCALAR_TOKEN}`,
      escalar: true,
      fonte: "local",
    };
  }

  if (/equipamento|m[aá]quina|s[eé]rie|painel/.test(p)) {
    return {
      texto:
        "Em Equipamentos você cadastra a série do painel, aloca no ponto e acompanha leituras. Use Editar na linha da máquina para preencher série e contadores. Se precisar de manutenção física, abra um chamado em Manutenção (não é este suporte).",
      escalar: false,
      fonte: "local",
    };
  }

  if (/coleta|rota|ponto/.test(p)) {
    return {
      texto:
        "Pontos são os locais. Coletas registram a visita. Rotas montam o dia de campo. Se algo específico não aparecer, diga qual tela e o que falta — ou peça para falar com um humano.",
      escalar: false,
      fonte: "local",
    };
  }

  return {
    texto: `Posso orientar no uso do OperaRoute. Se preferir atendimento humano, diga “falar com atendente”.\n\nEnquanto a IA completa não está disponível, posso te encaminhar agora.\n\n${ESCALAR_TOKEN}`,
    escalar: true,
    fonte: "local",
  };
}

export async function gerarRespostaSuporte(
  historico: { role: "user" | "assistant"; content: string }[],
  pergunta: string
): Promise<RespostaSuporteIA> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historico.slice(-10).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: pergunta },
  ];

  const result = await chatCompletion(messages, { maxTokens: 700, temperature: 0.4 });

  if (!result.ok) {
    return fallbackLocal(pergunta);
  }

  let texto = result.text;
  const escalar = texto.includes(ESCALAR_TOKEN);
  texto = texto.replaceAll(ESCALAR_TOKEN, "").trim();

  return { texto, escalar, fonte: "openai" };
}
