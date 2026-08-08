/**
 * Repara Pikiri após bug do "receber agora" (pagamento zerado + consolidada duplicada).
 *
 * Situação real:
 * - Dívida antes: R$ 1.240 (370+210+245+315+100)
 * - Nova operação: R$ 105
 * - Usuário digitou R$ 1.313,60 como pagamento total
 * - App não aplicou o pagamento e criou consolidada R$ 1.313,60 em cima
 *
 * Correção:
 * - Aplica o pagamento R$ 1.313,60 em FIFO nas dívidas
 * - Remove a consolidada espúria de R$ 1.313,60
 * - Deixa só o restante real: 1240 + 105 - 1313.60 = R$ 31,40
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!process.env[k]) process.env[k] = v;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMPRESA_ID = "cd26efc8-19ac-4fb8-b93e-c569cce6cc75";
const PAGAMENTO_INFORMADO = 1313.6;
const NOVA_OPERACAO = 105;

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const { data: abertas, error } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status, descricao, created_at, ponto_id")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta")
    .neq("tipo", "haver")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // A consolidada de 1313.60 é o fantasma do bug — remove primeiro.
  const fantasma = (abertas ?? []).find(
    (p) =>
      p.tipo === "visita_consolidada" &&
      Math.abs(Number(p.valor) - 1313.6) < 0.02
  );
  if (fantasma) {
    const nota =
      "Corrigido: consolidada gerada com pagamento zerado no fluxo receber-agora (campo pix/dinheiro). Removida.";
    await supabase
      .from("pendencias")
      .update({
        status: "resolvida",
        valor: 0,
        resolvido_em: new Date().toISOString(),
        descricao: fantasma.descricao
          ? `${fantasma.descricao}\n${nota}`
          : nota,
      })
      .eq("id", fantasma.id);
    console.log("Removida consolidada fantasma 1313.60");
  }

  const { data: restantes } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, descricao, created_at, ponto_id")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta")
    .neq("tipo", "haver")
    .order("created_at", { ascending: true });

  const dividaAntes = round2(
    (restantes ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0)
  );
  console.log("Dívida aberta após remover fantasma:", dividaAntes);

  // Aplica o pagamento informado em FIFO
  let saldo = PAGAMENTO_INFORMADO;
  const pontoId = restantes?.[0]?.ponto_id ?? null;

  for (const p of restantes ?? []) {
    if (saldo <= 0.009) break;
    const valor = Number(p.valor ?? 0);
    const baixa = round2(Math.min(saldo, valor));
    const novo = round2(Math.max(0, valor - baixa));
    const nota = `Baixa de R$ ${baixa.toFixed(2).replace(".", ",")} — correção pagamento receber-agora 29/07/2026`;
    await supabase
      .from("pendencias")
      .update({
        valor: novo,
        status: novo <= 0.009 ? "resolvida" : "aberta",
        resolvido_em: novo <= 0.009 ? new Date().toISOString() : null,
        descricao: p.descricao ? `${p.descricao}\n${nota}` : nota,
      })
      .eq("id", p.id);
    saldo = round2(saldo - baixa);
    console.log(`Baixa ${baixa} em ${p.id} (${p.tipo}) → resto ${novo}`);
  }

  // Sobra do pagamento cobre parte da nova operação; o que faltar vira pendência.
  const pagoNaNovaOp = round2(Math.min(NOVA_OPERACAO, saldo));
  saldo = round2(saldo - pagoNaNovaOp);
  const faltaNovaOp = round2(Math.max(0, NOVA_OPERACAO - pagoNaNovaOp));

  if (faltaNovaOp > 0.009 && pontoId) {
    await supabase.from("pendencias").insert({
      empresa_id: EMPRESA_ID,
      ponto_id: pontoId,
      tipo: "pagamento_pendente",
      titulo: "Pagamento pendente da coleta",
      descricao:
        "Restante após correção do receber-agora — operação de 29/07/2026 (R$ 105,00 − parte paga no total digitado).",
      valor: faltaNovaOp,
      status: "aberta",
      prioridade: "media",
    });
    console.log("Criada pendência restante nova operação:", faltaNovaOp);
  }

  const { data: after } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta")
    .neq("tipo", "haver");

  const soma = round2(
    (after ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0)
  );
  console.log("Pendências abertas finais:", JSON.stringify(after, null, 2));
  console.log("Soma a receber:", soma.toFixed(2));
  console.log("Esperado ~31.40 (1240+105-1313.60)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
