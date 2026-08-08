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

const { data: fin, error } = await sb
  .from("financeiro")
  .select("id,valor,tipo,categoria,descricao,created_at,visita_id,forma_pagamento,ponto_id")
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .order("created_at", { ascending: false })
  .limit(40);

console.log("FIN ERR", error);
console.log("FIN COUNT", fin?.length ?? 0);
for (const f of fin ?? []) {
  console.log(
    JSON.stringify({
      valor: f.valor,
      tipo: f.tipo,
      cat: f.categoria,
      created: f.created_at,
      visita: f.visita_id ? "sim" : "nao",
      desc: (f.descricao || "").slice(0, 80),
    })
  );
}

const somaEntradas = (fin ?? [])
  .filter((f) => f.tipo === "entrada")
  .reduce((s, f) => s + Number(f.valor || 0), 0);
console.log("SOMA ENTRADAS (últimas 40):", somaEntradas.toFixed(2));

for (const t of ["visitas", "visitas_cassino", "coleta_visitas", "operacoes"]) {
  const r = await sb.from(t).select("id").limit(1);
  console.log("TABLE", t, r.error?.message || "ok", "rows", r.data?.length);
}

const { data: pendAbertas } = await sb
  .from("pendencias")
  .select("id,tipo,valor,status,titulo,descricao,visita_id,visita_ponto_id,created_at")
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .eq("status", "aberta");

console.log("\nPENDENCIAS ABERTAS:");
let soma = 0;
for (const p of pendAbertas ?? []) {
  soma += Number(p.valor || 0);
  console.log(
    JSON.stringify({
      tipo: p.tipo,
      valor: p.valor,
      visita_id: p.visita_id ? "sim" : "nao",
      vp: p.visita_ponto_id ? "sim" : "nao",
      titulo: p.titulo,
      desc: (p.descricao || "").slice(0, 100),
    })
  );
}
console.log("SOMA ABERTAS:", soma.toFixed(2));
