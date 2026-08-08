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

const { data, error } = await sb
  .from("pendencias")
  .select(
    "id,empresa_id,tipo,titulo,valor,status,descricao,visita_id,visita_ponto_id,created_at,pontos(nome)"
  )
  .eq("status", "aberta")
  .order("created_at", { ascending: false });

if (error) {
  console.error(error);
  process.exit(1);
}

const byEmp = {};
for (const r of data || []) {
  const emp = r.empresa_id;
  if (!byEmp[emp]) byEmp[emp] = { sum: 0, items: [] };
  if ((r.tipo || "").toLowerCase() === "haver") continue;
  const val = Number(r.valor || 0);
  byEmp[emp].sum += val;
  byEmp[emp].items.push({
    tipo: r.tipo,
    titulo: r.titulo,
    valor: val,
    ponto: (r.pontos && r.pontos.nome) || null,
    created_at: r.created_at,
    tem_visita: !!r.visita_id,
    tem_visita_ponto: !!r.visita_ponto_id,
    desc: (r.descricao || "").slice(0, 140),
  });
}
for (const v of Object.values(byEmp)) v.sum = Math.round(v.sum * 100) / 100;
console.log(JSON.stringify(byEmp, null, 2));
