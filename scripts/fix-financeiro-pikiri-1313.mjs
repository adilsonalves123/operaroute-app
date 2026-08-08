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
const pid = "51665ad3-c4ac-4c3f-bf55-2ce3b5abec80";

// Pagamento real do receber-agora (1345 - 31.40 = 1313.60) nunca entrou no financeiro.
const { data: existing } = await sb
  .from("financeiro")
  .select("id, valor, descricao, created_at")
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .eq("tipo", "entrada")
  .gte("created_at", "2026-07-29T00:00:00Z");

console.log("Entradas hoje:", existing);

const already = (existing ?? []).some(
  (e) =>
    Math.abs(Number(e.valor) - 1313.6) < 0.02 ||
    String(e.descricao || "").includes("correção receber-agora")
);

if (already) {
  console.log("Financeiro 1313.60 já existe — skip");
} else {
  const { data, error } = await sb
    .from("financeiro")
    .insert({
      empresa_id: eid,
      ponto_id: pid,
      tipo: "entrada",
      categoria: "Coleta cassino",
      valor: 1313.6,
      descricao:
        "Coleta - Pikiri (Pix R$ 1.313,60) — correção receber-agora 29/07/2026 (pagamento aplicado nas pendências, faltava lançamento financeiro)",
      forma_pagamento: "pix",
    })
    .select("id, valor")
    .maybeSingle();
  console.log("Insert financeiro:", data, error);
}

const { data: abertas } = await sb
  .from("pendencias")
  .select("id, tipo, valor, status, titulo, visita_id")
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .eq("status", "aberta");

console.log("Pendências abertas:", abertas);
console.log(
  "Soma A receber:",
  (abertas ?? []).reduce((s, p) => s + Number(p.valor || 0), 0).toFixed(2)
);
