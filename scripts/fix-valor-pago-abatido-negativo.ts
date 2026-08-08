/**
 * Reverte valor_pago fantasma: pendência de operação abatida em visita negativa
 * não é recebimento. Roda: npx tsx scripts/fix-valor-pago-abatido-negativo.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envPath = process.argv.includes("--prod-env")
  ? ".env.vercel.audit"
  : ".env.local";

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function parseAbatido(descricao: string | null): number {
  if (!descricao) return 0;
  // "Baixa de R$ 700,00 na coleta..." ou "Abatido R$ 700,00"
  const m = descricao.match(
    /(?:baixa\s+de|abatido)\s*r\$\s*([\d.]+(?:,\d{2})?)/i
  );
  if (!m) return 0;
  const raw = m[1].includes(",")
    ? m[1].replace(/\./g, "").replace(",", ".")
    : m[1];
  return round2(Number(raw) || 0);
}

function visitaNegativaId(descricao: string | null): string | null {
  if (!descricao) return null;
  const m = descricao.match(/\[visita:([0-9a-f-]{36})\]/i);
  return m?.[1] ?? null;
}

async function main() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.DONO_EMAIL;
  const password = env.DONO_PASSWORD;
  if (!url || !anon || !email || !password) {
    console.error("Precisa URL/ANON/DONO_EMAIL/DONO_PASSWORD");
    process.exit(1);
  }

  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error("Login falhou:", authErr.message);
    process.exit(1);
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("empresa_id")
    .maybeSingle();
  const empresaId = profile?.empresa_id as string | undefined;
  if (!empresaId) {
    console.error("Sem empresa_id");
    process.exit(1);
  }

  const { data: negVisitas, error: nErr } = await sb
    .from("visitas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("saldo_negativo", true);
  if (nErr) {
    console.error(nErr);
    process.exit(1);
  }
  const negIds = new Set((negVisitas ?? []).map((v) => v.id));

  const { data: pends, error: pErr } = await sb
    .from("pendencias")
    .select("id, visita_id, tipo, valor, descricao, status")
    .eq("empresa_id", empresaId)
    .in("tipo", ["pagamento_pendente", "parcial", "visita_consolidada"]);
  if (pErr) {
    console.error(pErr);
    process.exit(1);
  }

  /** soma a reverter por visita de origem */
  const reverterPorVisita = new Map<string, number>();

  for (const p of pends ?? []) {
    const negId = visitaNegativaId(p.descricao);
    if (!negId || !negIds.has(negId)) continue;
    const origem = p.visita_id as string | null;
    if (!origem || negIds.has(origem)) continue;
    const abatido = parseAbatido(p.descricao);
    if (abatido <= 0.009) continue;
    reverterPorVisita.set(
      origem,
      round2((reverterPorVisita.get(origem) ?? 0) + abatido)
    );
  }

  console.log("Visitas a corrigir:", reverterPorVisita.size);

  let fixed = 0;
  for (const [visitaId, abatido] of reverterPorVisita) {
    const { data: v } = await sb
      .from("visitas")
      .select("id, valor_pago, restante, valor_operacao_efetivo, valor_operacao")
      .eq("id", visitaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!v) continue;

    const pago = Number(v.valor_pago ?? 0);
    if (pago <= 0.009) {
      console.log(visitaId, "já sem pago — skip");
      continue;
    }

    const tirar = round2(Math.min(pago, abatido));
    const novoPago = round2(pago - tirar);
    const efetivo = Number(v.valor_operacao_efetivo ?? v.valor_operacao ?? 0);
    const novoRestante =
      efetivo > 0.009
        ? round2(Math.max(0, efetivo - novoPago))
        : round2(Math.max(0, Number(v.restante ?? 0)));

    const { error: uErr } = await sb
      .from("visitas")
      .update({ valor_pago: novoPago, restante: novoRestante })
      .eq("id", visitaId)
      .eq("empresa_id", empresaId);

    if (uErr) {
      console.error("fail", visitaId, uErr.message);
      continue;
    }
    console.log(
      `OK ${visitaId}: pago ${pago} → ${novoPago} (reverteu ${tirar}), restante ${novoRestante}`
    );
    fixed++;
  }

  console.log(`Corrigidas: ${fixed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
