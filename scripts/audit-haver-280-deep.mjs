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

// Haver resolvido com 248
const { data: haver } = await sb
  .from("pendencias")
  .select("*")
  .eq("id", "9d4930fe-0000-0000-0000-000000000000")
  .maybeSingle();

// buscar pelo prefixo
const { data: havers } = await sb
  .from("pendencias")
  .select("*")
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .eq("tipo", "haver")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("=== HAVERS ===");
for (const h of havers ?? []) {
  console.log(
    JSON.stringify(
      {
        id: h.id,
        status: h.status,
        valor: h.valor,
        resolvido_em: h.resolvido_em,
        created: h.created_at,
        visita_id: h.visita_id,
        desc: h.descricao,
      },
      null,
      2
    )
  );
}

const { data: pendOps } = await sb
  .from("pendencias")
  .select("*")
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .in("tipo", ["pagamento_pendente", "parcial", "visita_consolidada"])
  .gte("created_at", "2026-07-29T18:00:00Z")
  .order("created_at", { ascending: false });

console.log("\n=== PEND OPS DESDE 18h ===");
for (const p of pendOps ?? []) {
  console.log(
    JSON.stringify({
      id: p.id,
      status: p.status,
      tipo: p.tipo,
      valor: p.valor,
      created: p.created_at,
      resolvido: p.resolvido_em,
      visita_id: p.visita_id,
      desc: (p.descricao || "").slice(0, 200),
    })
  );
}

// Auditoria
const { data: audits, error: aErr } = await sb
  .from("auditoria")
  .select("acao, titulo, resumo, dados_novos, created_at, registro_id")
  .eq("empresa_id", eid)
  .gte("created_at", "2026-07-29T18:00:00Z")
  .order("created_at", { ascending: false })
  .limit(40);

console.log("\nAUD ERR", aErr);
console.log("=== AUDITORIA ===");
for (const a of audits ?? []) {
  const dn = a.dados_novos;
  console.log(
    JSON.stringify({
      acao: a.acao,
      titulo: a.titulo,
      resumo: a.resumo,
      created: a.created_at,
      registro: a.registro_id?.slice?.(0, 8) ?? a.registro_id,
      dados: dn,
    })
  );
}

// Tentar visitas via RPC ou outra tabela
const { data: vp } = await sb
  .from("visitas_ponto")
  .select(
    "id, status, subtotal_cobravel, valor_pago, restante, total_cobrado, divida_anterior_total, created_at, finalizada_em, ponto_id"
  )
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .gte("created_at", "2026-07-29T00:00:00Z")
  .order("created_at", { ascending: false });

console.log("\n=== VISITAS PONTO HOJE ===");
for (const v of vp ?? []) {
  console.log(JSON.stringify(v));
}

const { data: itens } = await sb
  .from("visita_ponto_itens")
  .select("visita_ponto_id, cassino_visita_id, nicho, created_at")
  .eq("empresa_id", eid)
  .gte("created_at", "2026-07-29T18:00:00Z")
  .order("created_at", { ascending: false });

console.log("\n=== ITENS VISITA ===");
console.log(JSON.stringify(itens, null, 2));

// financeiro all empresa today
const { data: fin } = await sb
  .from("financeiro")
  .select("valor, tipo, categoria, descricao, created_at, ponto_id")
  .eq("empresa_id", eid)
  .gte("created_at", "2026-07-29T00:00:00Z")
  .order("created_at", { ascending: false });

console.log("\n=== FIN ALL HOJE ===");
let ent = 0;
for (const f of fin ?? []) {
  if (f.tipo === "entrada") ent += Number(f.valor);
  console.log(
    JSON.stringify({
      tipo: f.tipo,
      valor: f.valor,
      cat: f.categoria,
      desc: (f.descricao || "").slice(0, 90),
      created: f.created_at,
      ponto: f.ponto_id?.slice(0, 8),
    })
  );
}
console.log("SOMA ENTRADAS HOJE", ent.toFixed(2));
