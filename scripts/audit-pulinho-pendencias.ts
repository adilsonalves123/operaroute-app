/**
 * Audita visitas e pendências do ponto Pulinho — origem dos R$ 600.
 * Uso: npx tsx scripts/audit-pulinho-pendencias.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / ANON_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

function brl(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

async function main() {
  const { data: pontos, error: pErr } = await supabase
    .from("pontos")
    .select("id, nome, empresa_id")
    .or("nome.ilike.%pulinho%,nome.ilike.%paulinho%");

  if (pErr) {
    console.error("Erro pontos:", pErr.message);
    process.exit(1);
  }

  if (!pontos?.length) {
    const { data: todos } = await supabase.from("pontos").select("id, nome").limit(20);
    console.log("Nenhum ponto Pulinho/Paulinho. Pontos no banco:", todos?.map((p) => p.nome).join(", ") ?? "(vazio ou sem permissão)");
    process.exit(0);
  }

  for (const ponto of pontos) {
    console.log("\n" + "=".repeat(60));
    console.log(`PONTO: ${ponto.nome} (${ponto.id})`);

    const { data: visitas } = await supabase
      .from("visitas")
      .select(
        "id, created_at, saldo_negativo, total_lucro_centavos, desconto, valor_cliente, valor_operacao, valor_operacao_efetivo, valor_pago, debito_abatido, restante, adiantamento_pix, adiantamento_dinheiro"
      )
      .eq("ponto_id", ponto.id)
      .order("created_at", { ascending: true });

    console.log(`\n--- VISITAS (${visitas?.length ?? 0}) ---`);
    for (const v of visitas ?? []) {
      const lucro = Number(v.total_lucro_centavos) / 100;
      const tipo = v.saldo_negativo ? "NEGATIVA" : "POSITIVA";
      console.log(`\n[${tipo}] ${new Date(v.created_at).toLocaleString("pt-BR")}  id=${v.id.slice(0, 8)}…`);
      console.log(`  Lucro visor: ${brl(lucro)}`);
      console.log(`  Comissão (valor_cliente): ${brl(Number(v.valor_cliente ?? 0))}`);
      console.log(`  Valor operação: ${brl(Number(v.valor_operacao ?? 0))}`);
      console.log(`  Operação efetiva: ${brl(Number(v.valor_operacao_efetivo ?? 0))}`);
      console.log(`  Pago (Pix+dinheiro): ${brl(Number(v.valor_pago ?? 0))}`);
      console.log(`  Débito abatido (negativo): ${brl(Number(v.debito_abatido ?? 0))}`);
      console.log(`  Reposto/adiantamento (desconto): ${brl(Number(v.desconto ?? 0))}`);
      console.log(`  Restante gravado: ${brl(Number(v.restante ?? 0))}`);
      if (v.saldo_negativo) {
        console.log(
          `  Adiantamento: Pix ${brl(Number(v.adiantamento_pix ?? 0))} + Dinheiro ${brl(Number(v.adiantamento_dinheiro ?? 0))}`
        );
      }

      const { data: pendCriadas } = await supabase
        .from("pendencias")
        .select("id, tipo, titulo, valor, status, descricao")
        .eq("visita_id", v.id);

      if (pendCriadas?.length) {
        console.log("  Pendências criadas nesta visita:");
        for (const pend of pendCriadas) {
          console.log(
            `    · ${pend.tipo} | ${pend.titulo} | ${brl(Number(pend.valor ?? 0))} | ${pend.status}`
          );
          if (pend.descricao) console.log(`      ${pend.descricao.split("\n")[0]}`);
        }
      }

      if (!v.saldo_negativo) {
        const opEf = Number(v.valor_operacao_efetivo ?? 0);
        const pago = Number(v.valor_pago ?? 0);
        const abatNeg = Number(v.debito_abatido ?? 0);
        const pagoOp = Math.max(0, pago - abatNeg);
        const restOpEsperado = Math.max(0, opEf - pagoOp);
        console.log(`  → Esperado dívida operação (restanteOperacao): ${brl(restOpEsperado)}`);
      }
    }

    const { data: pendencias } = await supabase
      .from("pendencias")
      .select("id, tipo, titulo, valor, status, descricao, visita_id, created_at")
      .eq("ponto_id", ponto.id)
      .order("created_at", { ascending: true });

    console.log(`\n--- TODAS PENDÊNCIAS (${pendencias?.length ?? 0}) ---`);
    for (const pend of pendencias ?? []) {
      console.log(
        `\n${pend.status.toUpperCase()} | ${pend.tipo} | ${brl(Number(pend.valor ?? 0))} | ${pend.titulo}`
      );
      console.log(`  id=${pend.id.slice(0, 8)}… visita_id=${pend.visita_id?.slice(0, 8) ?? "—"}…`);
      console.log(`  criada: ${new Date(pend.created_at).toLocaleString("pt-BR")}`);
      if (pend.descricao) console.log(`  desc: ${pend.descricao.slice(0, 120)}`);
    }

    const abertas = (pendencias ?? []).filter((p) => p.status === "aberta");
    const negativas = abertas.filter((p) => p.tipo?.toLowerCase() === "negativo");
    const operacao = abertas.filter((p) =>
      ["pagamento_pendente", "parcial"].includes(p.tipo?.toLowerCase() ?? "")
    );

    const totalNeg = negativas.reduce((s, p) => s + Number(p.valor ?? 0), 0);
    const totalOp = operacao.reduce((s, p) => s + Number(p.valor ?? 0), 0);

    console.log("\n--- RESUMO ABERTO (como a nova coleta calcula) ---");
    console.log(`Negativo em aberto (soma valor campo): ${brl(totalNeg)}`);
    console.log(`Pagamento parcial/pendente (soma valor campo): ${brl(totalOp)}`);
    if (operacao.length) {
      console.log("Detalhe operação:");
      for (const p of operacao) {
        console.log(`  · ${brl(Number(p.valor ?? 0))} — ${p.titulo} (${p.tipo})`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
