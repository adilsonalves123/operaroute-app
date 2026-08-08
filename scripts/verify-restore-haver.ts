/**
 * Simula restore de haver ao excluir coleta (mesma regra do DELETE).
 * Moderno: valor=saldo + Compensado → devolve somando.
 */
import assert from "node:assert/strict";

const ABATIDO_LINE_REGEX = /Abatido R\$ ([\d.,]+)/;
const BAIXA_LINE_REGEX = /Baixa de R\$ ([\d.,]+)/;
const COMPENSADO_LINE_REGEX = /Compensado R\$ ([\d.,]+)/;

function parseValorBR(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

function valorAbatimentoLinha(linha: string): number {
  const match =
    linha.match(ABATIDO_LINE_REGEX) ??
    linha.match(BAIXA_LINE_REGEX) ??
    linha.match(COMPENSADO_LINE_REGEX);
  return match ? parseValorBR(match[1]) : 0;
}

function reverterHaver(
  valorAtual: number,
  descricao: string,
  visitaId: string
): { valor: number; descricao: string | null } {
  let removidoCompensado = 0;
  let removidoAbatido = 0;
  let removidoBaixa = 0;
  const manter: string[] = [];

  for (const linha of descricao.split("\n")) {
    if (/Compensado parcial/i.test(linha) && !COMPENSADO_LINE_REGEX.test(linha)) {
      continue;
    }
    const marcada = linha.includes(`[visita:${visitaId}]`);
    if (!marcada) {
      if (linha.trim()) manter.push(linha);
      continue;
    }
    const v = valorAbatimentoLinha(linha);
    if (v <= 0.009) {
      if (linha.trim()) manter.push(linha);
      continue;
    }
    if (COMPENSADO_LINE_REGEX.test(linha)) removidoCompensado += v;
    else if (ABATIDO_LINE_REGEX.test(linha)) removidoAbatido += v;
    else removidoBaixa += v;
  }

  const removido = removidoCompensado + removidoAbatido + removidoBaixa;
  const estiloModerno =
    removidoCompensado > 0.009 || /Compensado R\$/i.test(descricao);
  const novoValor = estiloModerno ? valorAtual + removido : valorAtual;
  return { valor: novoValor, descricao: manter.join("\n").trim() || null };
}

// Caso usuário: haver 565, operação abateu 175 → valor 390 + Compensado 175
const visitaId = "vis-abc";
const aposAbate = {
  valor: 390,
  desc: `Cliente pagou ganhadores\nCompensado R$ 175,00 na coleta de 03/08/2026 [visita:${visitaId}]`,
};
const restored = reverterHaver(aposAbate.valor, aposAbate.desc, visitaId);
assert.equal(Math.round(restored.valor * 100), 56500, `esperado 565, got ${restored.valor}`);
assert.ok(!restored.descricao?.includes("Compensado R$ 175"));

// Haver totalmente quitado
const quitado = reverterHaver(
  0,
  `Compensado R$ 565,00 na coleta de 03/08/2026 [visita:${visitaId}]`,
  visitaId
);
assert.equal(Math.round(quitado.valor * 100), 56500);

// Estilo antigo: valor bruto + Abatido (não soma de novo)
const antigo = reverterHaver(
  565,
  `Abatido R$ 175,00 na coleta de 03/08/2026 [visita:${visitaId}]`,
  visitaId
);
assert.equal(Math.round(antigo.valor * 100), 56500);
assert.ok(!antigo.descricao?.includes("Abatido"));

// Operação: Baixa de R$ 700 em pendência resolvida → volta aberta
function reverterOperacao(
  valorAtual: number,
  descricao: string,
  visitaId: string
): number {
  let removido = 0;
  for (const linha of descricao.split("\n")) {
    if (!linha.includes(`[visita:${visitaId}]`)) continue;
    removido += valorAbatimentoLinha(linha);
  }
  return valorAtual + removido;
}
const op = reverterOperacao(
  0,
  `Baixa de R$ 700,00 na coleta de 05/08/2026 [visita:${visitaId}]`,
  visitaId
);
assert.equal(Math.round(op * 100), 70000);

console.log("✓ restore haver/operação na exclusão OK");
