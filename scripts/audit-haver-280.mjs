import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const eid = "cd26efc8-19ac-4fb8-b93e-c569cce6cc75";

// Busca pendências recentes com 280 / 248 / 318 / 32
const { data: pends, error: pErr } = await sb
  .from("pendencias")
  .select(
    "id, ponto_id, tipo, status, valor, titulo, descricao, visita_id, visita_ponto_id, created_at, resolvido_em, pontos(nome)"
  )
  .eq("empresa_id", eid)
  .gte("created_at", "2026-07-28T00:00:00Z")
  .order("created_at", { ascending: false })
  .limit(80);

console.log("PEND ERR", pErr);
for (const p of pends ?? []) {
  const v = Number(p.valor ?? 0);
  const nome = Array.isArray(p.pontos) ? p.pontos[0]?.nome : p.pontos?.nome;
  const hit =
    Math.abs(v - 280) < 0.05 ||
    Math.abs(v - 248) < 0.05 ||
    Math.abs(v - 318) < 0.05 ||
    Math.abs(v - 32) < 0.05 ||
    String(p.descricao || "").includes("248") ||
    String(p.descricao || "").includes("280") ||
    String(p.titulo || "").toLowerCase().includes("haver");
  if (!hit && p.status !== "aberta") continue;
  if (!hit && p.status === "aberta" && v < 1) continue;
  console.log(
    JSON.stringify({
      nome,
      status: p.status,
      tipo: p.tipo,
      valor: v,
      titulo: p.titulo,
      desc: (p.descricao || "").slice(0, 160),
      visita: p.visita_id ? "sim" : "nao",
      vp: p.visita_ponto_id ? "sim" : "nao",
      created: p.created_at,
      resolvido: p.resolvido_em,
      id: p.id.slice(0, 8),
      ponto: p.ponto_id?.slice(0, 8),
    })
  );
}

const { data: abertas } = await sb
  .from("pendencias")
  .select("id, ponto_id, tipo, valor, titulo, descricao, visita_id, created_at, pontos(nome)")
  .eq("empresa_id", eid)
  .eq("status", "aberta")
  .order("created_at", { ascending: false });

console.log("\n=== TODAS ABERTAS ===");
let soma = 0;
for (const p of abertas ?? []) {
  const v = Number(p.valor ?? 0);
  soma += v;
  const nome = Array.isArray(p.pontos) ? p.pontos[0]?.nome : p.pontos?.nome;
  console.log(
    JSON.stringify({
      nome,
      tipo: p.tipo,
      valor: v,
      titulo: p.titulo,
      desc: (p.descricao || "").slice(0, 120),
      visita: p.visita_id ? "sim" : "nao",
      created: p.created_at,
    })
  );
}
console.log("SOMA ABERTAS", soma.toFixed(2));

const { data: fin } = await sb
  .from("financeiro")
  .select("id, ponto_id, valor, tipo, categoria, descricao, created_at, pontos(nome)")
  .eq("empresa_id", eid)
  .gte("created_at", "2026-07-29T00:00:00Z")
  .order("created_at", { ascending: false })
  .limit(40);

console.log("\n=== FINANCEIRO HOJE ===");
for (const f of fin ?? []) {
  const nome = Array.isArray(f.pontos) ? f.pontos[0]?.nome : f.pontos?.nome;
  console.log(
    JSON.stringify({
      nome,
      tipo: f.tipo,
      valor: f.valor,
      cat: f.categoria,
      desc: (f.descricao || "").slice(0, 100),
      created: f.created_at,
    })
  );
}
