/**
 * Auditoria: últimas visitas, financeiro e pendências do Pikiri.
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMPRESA = "cd26efc8-19ac-4fb8-b93e-c569cce6cc75";

const { data: pontos } = await sb
  .from("pontos")
  .select("id, nome")
  .eq("empresa_id", EMPRESA)
  .ilike("nome", "%pikiri%");

const pontoId = pontos?.[0]?.id;
console.log("PONTO", pontos);

const { data: pens } = await sb
  .from("pendencias")
  .select(
    "id, tipo, titulo, valor, status, visita_id, visita_ponto_id, descricao, created_at, resolvido_em"
  )
  .eq("empresa_id", EMPRESA)
  .eq("ponto_id", pontoId)
  .gte("created_at", "2026-07-29T00:00:00Z")
  .order("created_at", { ascending: true });

console.log("\nPENDENCIAS HOJE:");
for (const p of pens ?? []) {
  console.log(
    JSON.stringify({
      status: p.status,
      tipo: p.tipo,
      valor: p.valor,
      visita_id: p.visita_id ? "sim" : "nao",
      visita_ponto_id: p.visita_ponto_id ? "sim" : "nao",
      created: p.created_at,
      resolvido: p.resolvido_em,
      titulo: p.titulo,
      desc: (p.descricao || "").slice(0, 160),
    })
  );
}

const { data: visitas, error: ve } = await sb
  .from("visitas")
  .select(
    "id, created_at, valor_operacao, valor_operacao_efetivo, valor_pago, restante, valor_pix, valor_dinheiro, saldo_negativo, total_lucro_centavos"
  )
  .eq("empresa_id", EMPRESA)
  .eq("ponto_id", pontoId)
  .gte("created_at", "2026-07-29T00:00:00Z")
  .order("created_at", { ascending: true });

console.log("\nVISITAS_ERR", ve);
console.log("\nVISITAS HOJE:");
for (const v of visitas ?? []) {
  console.log(
    JSON.stringify({
      id: v.id.slice(0, 8),
      created: v.created_at,
      operacao: v.valor_operacao,
      efetivo: v.valor_operacao_efetivo,
      pago: v.valor_pago,
      restante: v.restante,
      pix: v.valor_pix,
      dinheiro: v.valor_dinheiro,
      negativo: v.saldo_negativo,
      lucro_cent: v.total_lucro_centavos,
    })
  );
}

const { data: fin, error: fe } = await sb
  .from("financeiro")
  .select("id, tipo, categoria, valor, descricao, created_at, visita_id")
  .eq("empresa_id", EMPRESA)
  .eq("ponto_id", pontoId)
  .gte("created_at", "2026-07-29T00:00:00Z")
  .order("created_at", { ascending: true });

console.log("\nFIN_ERR", fe);
console.log("\nFINANCEIRO HOJE:");
for (const f of fin ?? []) {
  console.log(
    JSON.stringify({
      tipo: f.tipo,
      cat: f.categoria,
      valor: f.valor,
      created: f.created_at,
      desc: (f.descricao || "").slice(0, 120),
    })
  );
}

const abertas = (pens ?? []).filter((p) => p.status === "aberta" && p.tipo !== "haver");
const soma = abertas.reduce((s, p) => s + Number(p.valor || 0), 0);
console.log("\nSOMA A RECEBER ABERTAS:", soma.toFixed(2));
