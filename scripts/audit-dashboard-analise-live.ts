/**
 * Auditoria live via login dono (RLS) — service_role está sem GRANT em visitas.
 * Roda: npx tsx scripts/audit-dashboard-analise-live.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import {
  liquidoRecebidoCassinoVisita,
  lucroOperacaoCassinoVisita,
} from "../src/lib/nichos/cassino/lucro-recebido";
import { centesimosToReais } from "../src/lib/nichos/cassino/contadores";

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
      // Vercel às vezes escapa
      v = v.replace(/\\n/g, "\n");
      return [l.slice(0, i).trim(), v];
    })
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.DONO_EMAIL;
  const password = env.DONO_PASSWORD;

  if (!url) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }
  if (!/^https?:\/\//i.test(url)) {
    console.error(
      "URL inválida (len=" +
        url.length +
        ", redacted=" +
        String(url.includes("SENSITIVE")) +
        ", envFile=" +
        envPath +
        ")"
    );
    process.exit(1);
  }

  let sb = createClient(url, serviceKey || anon!, {
    auth: { persistSession: false },
  });
  let empresaId: string | null = null;

  // 1) Tenta service role
  if (serviceKey) {
    const probe = await sb
      .from("visitas")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (!probe.error) {
      empresaId = "cd26efc8-19ac-4fb8-b93e-c569cce6cc75";
      console.error("Auth: service_role OK");
    } else {
      console.error("service_role falhou:", probe.error.message);
    }
  }

  // 2) Fallback: login dono
  if (!empresaId) {
    if (!anon || !email || !password) {
      console.error("Sem service_role útil e sem DONO_EMAIL/DONO_PASSWORD");
      process.exit(1);
    }
    sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
      email,
      password,
    });
    if (authErr || !auth.session) {
      console.error("Login dono falhou:", authErr?.message);
      process.exit(1);
    }
    const { data: profile, error: profErr } = await sb
      .from("profiles")
      .select("empresa_id, role")
      .eq("user_id", auth.user!.id)
      .maybeSingle();
    if (profErr || !profile?.empresa_id) {
      console.error("Profile:", profErr?.message ?? "sem empresa_id");
      process.exit(1);
    }
    empresaId = profile.empresa_id as string;
    console.error("Auth: dono RLS OK");
  }
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: visitas, error } = await sb
    .from("visitas")
    .select(
      `id, ponto_id, created_at, saldo_negativo, total_lucro_centavos,
       valor_operacao, valor_operacao_efetivo, valor_pago, restante, desconto,
       adiantamento_pix, adiantamento_dinheiro, valor_cliente,
       pontos(nome)`
    )
    .eq("empresa_id", empresaId)
    .gte("created_at", startOfMonth)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("ERRO visitas", error);
    process.exit(1);
  }

  const { data: pendencias, error: pErr } = await sb
    .from("pendencias")
    .select("id, tipo, titulo, valor, status, visita_id, descricao, ponto_id")
    .eq("empresa_id", empresaId)
    .eq("status", "aberta")
    .limit(800);

  if (pErr) {
    console.error("ERRO pendencias", pErr);
    process.exit(1);
  }

  type Row = {
    id: string;
    ponto: string;
    data: string;
    tipo: "positiva" | "negativa";
    lucroMaquina: number;
    operacao: number;
    pago: number;
    restante: number;
    dashboard: number;
    analise: number;
    delta: number;
    classif: string;
  };

  const rows: Row[] = [];
  let sumDash = 0;
  let sumAnalise = 0;
  let nPos = 0;
  let nNeg = 0;
  let nPendentes = 0;
  let nDeixado = 0;

  for (const v of visitas ?? []) {
    const input = {
      saldo_negativo: v.saldo_negativo,
      total_lucro_centavos: v.total_lucro_centavos,
      valor_operacao: v.valor_operacao,
      valor_operacao_efetivo: v.valor_operacao_efetivo,
      valor_pago: v.valor_pago,
      restante: v.restante,
      desconto: v.desconto,
      adiantamento_pix: v.adiantamento_pix,
      adiantamento_dinheiro: v.adiantamento_dinheiro,
    };
    const dashboard = lucroOperacaoCassinoVisita(input);
    const analise = liquidoRecebidoCassinoVisita(input);
    const lucroMaquina = round2(
      centesimosToReais(Number(v.total_lucro_centavos ?? 0))
    );
    const negativa = Boolean(v.saldo_negativo) || lucroMaquina < -0.009;
    if (negativa) nNeg++;
    else nPos++;

    const delta = round2(dashboard - analise);
    if (delta > 0.009) nPendentes++;
    if (negativa && analise < -0.009) nDeixado++;

    const pontoRaw = v.pontos as { nome?: string } | { nome?: string }[] | null;
    const ponto = Array.isArray(pontoRaw)
      ? pontoRaw[0]?.nome ?? "?"
      : pontoRaw?.nome ?? "?";

    let classif = "ok_iguais";
    if (negativa && analise < -0.009) classif = "neg_com_caixa";
    else if (negativa) classif = "neg_sem_caixa";
    else if (delta > 0.009) classif = "pos_parcial_ou_pendente";
    else if (
      Math.abs(Number(v.valor_pago ?? 0) - dashboard) < 0.05 &&
      dashboard > 0.009
    )
      classif = "pos_quitado";
    else if (dashboard <= 0.009 && analise <= 0.009) classif = "pos_zerado";

    rows.push({
      id: v.id,
      ponto,
      data: String(v.created_at).slice(0, 16).replace("T", " "),
      tipo: negativa ? "negativa" : "positiva",
      lucroMaquina,
      operacao: round2(
        Number(v.valor_operacao_efetivo ?? v.valor_operacao ?? 0)
      ),
      pago: round2(Number(v.valor_pago ?? 0)),
      restante: round2(Number(v.restante ?? 0)),
      dashboard,
      analise,
      delta,
      classif,
    });

    sumDash = round2(sumDash + dashboard);
    sumAnalise = round2(sumAnalise + analise);
  }

  let aReceber = 0;
  let haver = 0;
  for (const p of pendencias ?? []) {
    const tipo = (p.tipo ?? "").toLowerCase();
    const titulo = (p.titulo ?? "").toLowerCase();
    const valor = Number(p.valor ?? 0);
    const isHaver = tipo === "haver";
    const isOtherNicho =
      titulo.includes("fura") ||
      titulo.includes("ursinho") ||
      titulo.includes("divers") ||
      titulo.includes("bolinha") ||
      titulo.includes("consignado");
    if (isOtherNicho) continue;
    const isCassino =
      Boolean(p.visita_id) ||
      titulo.includes("visita") ||
      titulo.includes("operação") ||
      titulo.includes("operacao") ||
      titulo.includes("ganhadores") ||
      titulo.includes("negativo") ||
      isHaver;
    if (!isCassino && titulo.includes("coleta")) continue;
    if (!isCassino && !isHaver) continue;

    if (isHaver) haver = round2(haver + valor);
    else aReceber = round2(aReceber + valor);
  }

  const topDelta = [...rows]
    .filter((r) => Math.abs(r.delta) > 0.009)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 12);

  const negativos = rows.filter((r) => r.tipo === "negativa").slice(0, 10);
  const pendentes = rows
    .filter((r) => r.classif === "pos_parcial_ou_pendente")
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10);

  const byClass: Record<string, number> = {};
  for (const r of rows) {
    byClass[r.classif] = (byClass[r.classif] ?? 0) + 1;
  }

  const out = {
    periodo: {
      de: startOfMonth,
      ate: now.toISOString(),
      label: now.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    },
    totais: {
      visitas: rows.length,
      positivas: nPos,
      negativas: nNeg,
      dashboardLucroMes: sumDash,
      analiseLiquidoMes: sumAnalise,
      deltaCompetenciaVsCaixa: round2(sumDash - sumAnalise),
      aReceberAbertoCassino: aReceber,
      haverAbertoCassino: haver,
      visitasComDelta: nPendentes,
      negativasComSaidaCaixa: nDeixado,
    },
    porClassificacao: byClass,
    topDeltas: topDelta,
    amostraNegativas: negativos,
    amostraPendentes: pendentes,
    consistenteComCodigo: true,
  };

  writeFileSync(
    "scripts/audit-dashboard-analise-live-out.json",
    JSON.stringify(out, null, 2),
    "utf8"
  );
  console.log(JSON.stringify(out.totais, null, 2));
  console.log("porClassificacao", byClass);
  console.log("Wrote scripts/audit-dashboard-analise-live-out.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
