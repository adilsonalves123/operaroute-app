/**
 * Corrige duplicidade: visita_consolidada R$300 + negativo R$300 (Pikiri).
 * Mantém só o negativo aberto.
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

const VISITA_CONSOLIDADA_ID = "ad82831d-1d57-4041-b18d-9a4b0a285a2b";
const NEGATIVO_ID = "98f121c4-f31a-4a75-8b16-25888de45224";
const VISITA_PONTO_ID = "82232d97-3616-4a07-986f-7759867cdf1c";
const PONTO_ID = "51665ad3-c4ac-4c3f-bf55-2ce3b5abec80";

async function main() {
  const { data: consolidada, error: e1 } = await supabase
    .from("pendencias")
    .select("id, tipo, valor, status, descricao")
    .eq("id", VISITA_CONSOLIDADA_ID)
    .maybeSingle();
  if (e1) throw e1;
  if (!consolidada) {
    console.log("Pendência consolidada já não existe — ok");
  } else if (consolidada.status === "resolvida") {
    console.log("Pendência consolidada já resolvida — ok");
  } else {
    const nota =
      "Corrigido: duplicava o saldo negativo da mesma visita ao ponto (cassino). Mantida apenas a pendência tipo negativo.";
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
      .eq("id", VISITA_CONSOLIDADA_ID);
    if (error) throw error;
    console.log("visita_consolidada marcada como resolvida");
  }

  const { data: vp } = await supabase
    .from("visitas_ponto")
    .select("id, restante, total_cobrado, subtotal_cobravel, divida_anterior_total")
    .eq("id", VISITA_PONTO_ID)
    .maybeSingle();

  if (vp) {
    const restante = Number(vp.restante ?? 0);
    const total = Number(vp.total_cobrado ?? 0);
    const subtotal = Number(vp.subtotal_cobravel ?? 0);
    const divida = Number(vp.divida_anterior_total ?? 0);
    if (subtotal <= 0.009 && (restante > 0.009 || total > 0.009 || divida > 0.009)) {
      const { error } = await supabase
        .from("visitas_ponto")
        .update({
          restante: 0,
          total_cobrado: 0,
          divida_anterior_total: 0,
        })
        .eq("id", VISITA_PONTO_ID);
      if (error) throw error;
      console.log("visitas_ponto: restante/total/divida zeronados");
    } else {
      console.log("visitas_ponto sem ajuste necessário", JSON.stringify(vp));
    }
  }

  const { data: abertas } = await supabase
    .from("pendencias")
    .select("id, tipo, titulo, valor, status")
    .eq("ponto_id", PONTO_ID)
    .eq("status", "aberta");

  const soma = (abertas ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  console.log("Pendências abertas Pikiri:", JSON.stringify(abertas, null, 2));
  console.log("Soma a receber:", soma.toFixed(2));

  const { data: neg } = await supabase
    .from("pendencias")
    .select("id, status, valor")
    .eq("id", NEGATIVO_ID)
    .maybeSingle();
  console.log("Negativo mantido:", JSON.stringify(neg));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
