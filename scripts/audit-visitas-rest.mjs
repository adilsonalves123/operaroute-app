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

console.log("URL", env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40));
console.log("SERVICE KEY starts", env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20));
console.log("SERVICE KEY len", env.SUPABASE_SERVICE_ROLE_KEY?.length);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const eid = "cd26efc8-19ac-4fb8-b93e-c569cce6cc75";
const pid = "51665ad3-c4ac-4c3f-bf55-2ce3b5abec80";

// Try REST directly
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/visitas?empresa_id=eq.${eid}&ponto_id=eq.${pid}&select=id,valor_operacao,valor_operacao_efetivo,valor_pago,restante,created_at&order=created_at.desc&limit=15`;
const res = await fetch(url, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
console.log("REST status", res.status);
const text = await res.text();
console.log(text.slice(0, 2000));
