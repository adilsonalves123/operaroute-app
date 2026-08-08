/**
 * Corrige: visita_consolidada R$580 duplicando dívidas já abertas (370+210+245).
 * Mantém só os pagamento_pendente → total 825.
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

async function main() {
  const { data: abertas, error } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status, descricao, created_at")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const consolidada = (abertas ?? []).find((p) => p.tipo === "visita_consolidada");
  if (!consolidada) {
    console.log("Nenhuma visita_consolidada aberta.");
  } else {
    const nota =
      "Corrigido: duplicava dívidas de operação já abertas (pagamento_pendente). Mantidas apenas as pendências de operação.";
    const { error: upErr } = await supabase
      .from("pendencias")
      .update({
        status: "resolvida",
        resolvido_em: new Date().toISOString(),
        descricao: consolidada.descricao
          ? `${consolidada.descricao}\n${nota}`
          : nota,
      })
      .eq("id", consolidada.id);
    if (upErr) throw upErr;
    console.log(
      `Resolvida consolidada ${consolidada.id} valor=${consolidada.valor}`
    );
  }

  const { data: after } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta")
    .neq("tipo", "haver");

  const soma = (after ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  console.log("Pendências abertas:", JSON.stringify(after, null, 2));
  console.log("Soma a receber:", soma.toFixed(2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
