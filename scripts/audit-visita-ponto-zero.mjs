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

const { data: vps } = await sb
  .from("visitas_ponto")
  .select(
    "id, status, subtotal_cobravel, valor_pago, total_cobrado, restante, valor_pix, valor_dinheiro, finalizada_em, created_at"
  )
  .eq("empresa_id", eid)
  .eq("ponto_id", pid)
  .order("created_at", { ascending: false })
  .limit(8);

console.log(JSON.stringify(vps, null, 2));
