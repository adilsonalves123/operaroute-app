/**
 * Corrige duplicidade atual: visita_consolidada R$580 + pagamentos pendentes R$370 e R$210.
 * Mantém só as dívidas de operação (370 + 210 = 580).
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const EMPRESA_ID = "cd26efc8-19ac-4fb8-b93e-c569cce6cc75";

async function main() {
  const { data: abertas, error: e0 } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status, descricao")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta");
  if (e0) throw e0;

  const consolidada = (abertas ?? [])
    .filter((p) => p.tipo === "visita_consolidada")
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )[0];
  if (!consolidada) {
    console.log("Consolidada alvo não encontrada entre as abertas.");
    console.log(JSON.stringify(abertas, null, 2));
    return;
  }

  const nota =
    "Corrigido: duplicava as pendências de operação das visitas cassino já abertas. Mantidas apenas as dívidas de operação.";
  const descricao = consolidada.descricao
    ? `${consolidada.descricao}\n${nota}`
    : nota;

  const { error } = await supabase
    .from("pendencias")
    .update({
      status: "resolvida",
      resolvido_em: new Date().toISOString(),
      descricao,
    })
    .eq("id", consolidada.id);
  if (error) throw error;

  const { data: after } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta")
    .neq("tipo", "haver");

  const soma = (after ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  console.log("Pendências abertas após correção:", JSON.stringify(after, null, 2));
  console.log("Soma a receber:", soma.toFixed(2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
