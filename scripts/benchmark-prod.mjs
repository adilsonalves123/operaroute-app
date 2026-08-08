/**
 * Benchmark de páginas autenticadas em produção local.
 * Uso: node scripts/benchmark-prod.mjs [baseUrl]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const baseUrl = process.argv[2] ?? "http://localhost:3001";
const email = "adi.end.music@hotmail.com";
const password = "123456";
const pontoId = "affe3bca-81a9-4059-b477-a0df70ad110f";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  console.error("Login falhou:", error.message);
  process.exit(1);
}

const session = auth.session;
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;
const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
const cookieHeader = `${cookieName}=${encodeURIComponent(cookieValue)}`;

const routes = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Coletas", path: "/coletas" },
  { name: "Ponto (Pulinho)", path: `/pontos/${pontoId}` },
];

async function measureRoute({ name, path }) {
  const url = `${baseUrl}${path}`;
  const times = [];

  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const res = await fetch(url, {
      headers: {
        cookie: cookieHeader,
        accept: "text/html",
      },
      redirect: "manual",
    });
    const body = await res.text();
    const elapsed = performance.now() - start;
    times.push(elapsed);

    if (res.status === 307 || res.status === 302) {
      return { name, path, error: `redirect ${res.status} -> ${res.headers.get("location")}` };
    }
    if (!res.ok) {
      return { name, path, error: `HTTP ${res.status}, body ${body.slice(0, 120)}` };
    }
    if (body.includes("/login")) {
      return { name, path, error: "resposta parece página de login (auth falhou)" };
    }
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { name, path, times, avg, min, max };
}

console.log(`\nBenchmark produção: ${baseUrl}`);
console.log(`Usuário: ${email}\n`);

const results = [];
for (const route of routes) {
  const r = await measureRoute(route);
  results.push(r);
  if (r.error) {
    console.log(`❌ ${r.name} (${r.path}): ${r.error}`);
  } else {
    console.log(
      `✅ ${r.name}: avg ${(r.avg / 1000).toFixed(2)}s | min ${(r.min / 1000).toFixed(2)}s | max ${(r.max / 1000).toFixed(2)}s`
    );
    console.log(`   runs: ${r.times.map((t) => (t / 1000).toFixed(2) + "s").join(", ")}`);
  }
}

const ok = results.filter((r) => !r.error);
if (ok.length) {
  const overall = ok.reduce((s, r) => s + r.avg, 0) / ok.length;
  console.log(`\nMédia geral (páginas OK): ${(overall / 1000).toFixed(2)}s`);
}
