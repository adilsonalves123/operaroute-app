/**
 * Corrige duplicidade: visita_consolidada R$70 + pagamento_pendente R$370 (Pikiri).
 * Mantém só a dívida da operação (370).
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

const CONSOLIDADA_ID = "ab3c9521-dfd0-4e73-83fd-68232b8abc2e";
const PAGAMENTO_ID = "2b335897-097b-4ac1-9635-49a3f77234ed";
const EMPRESA_ID = "cd26efc8-19ac-4fb8-b93e-c569cce6cc75";

async function main() {
  const { data: consolidada, error: e1 } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, status, descricao")
    .eq("id", CONSOLIDADA_ID)
    .maybeSingle();
  if (e1) throw e1;

  if (!consolidada) {
    console.log("Consolidada já não existe — ok");
  } else if (consolidada.status === "resolvida") {
    console.log("Consolidada já resolvida — ok");
  } else {
    const nota =
      "Corrigido: duplicava a dívida da operação já registrada como pagamento_pendente da mesma visita cassino. Mantida apenas a pendência de pagamento.";
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
      .eq("id", CONSOLIDADA_ID);
    if (error) throw error;
    console.log("visita_consolidada R$70 marcada como resolvida");
  }

  const { data: abertas } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status")
    .eq("empresa_id", EMPRESA_ID)
    .eq("status", "aberta")
    .neq("tipo", "haver");

  const soma = (abertas ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  console.log("Pendências abertas (a receber):", JSON.stringify(abertas, null, 2));
  console.log("Soma a receber:", soma.toFixed(2));

  const { data: pag } = await supabase
    .from("pendencias")
    .select("id, status, valor")
    .eq("id", PAGAMENTO_ID)
    .maybeSingle();
  console.log("Pagamento_pendente mantido:", JSON.stringify(pag));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
