import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "src");
const SKIP = new Set(["node_modules", ".next"]);

const REPLACEMENTS = [
  [/text-\[#f4efe6\]/g, "text-at-primary"],
  [/text-\[#f0ebe3\]/g, "text-at-primary"],
  [/text-\[#e8d5b0\]/g, "text-at-link"],
  [/text-\[#c4a574\]/g, "text-at-link"],
  [/text-\[#c4a574\]\/90/g, "text-at-link/90"],
  [/text-\[#c4a574\]\/80/g, "text-at-link/80"],
  [/text-slate-700/g, "text-at-soft"],
  [/text-slate-600/g, "text-at-soft"],
  [/text-slate-500/g, "text-at-muted"],
  [/text-slate-400/g, "text-at-muted"],
  [/text-slate-300/g, "text-at-primary/85"],
  [/text-slate-200/g, "text-at-primary/90"],
  [/border-white\/\[0\.06\]/g, "border-at"],
  [/border-white\/\[0\.07\]/g, "border-at"],
  [/border-white\/\[0\.08\]/g, "border-at-soft"],
  [/border-white\/10/g, "border-at-soft"],
  [/border-white\/15/g, "border-at-soft"],
  [/border-white\/20/g, "border-at"],
  [/bg-white\/\[0\.03\]/g, "bg-at-card-soft"],
  [/bg-white\/\[0\.04\]/g, "bg-at-card-soft"],
  [/bg-white\/\[0\.06\]/g, "bg-at-card-soft"],
  [/bg-\[#0a0e16\]/g, "bg-at-card"],
  [/bg-\[#0b1018\]/g, "bg-at-card"],
  [/divide-white\/\[0\.04\]/g, "divide-[var(--at-border-soft)]"],
  [/divide-white\/\[0\.06\]/g, "divide-[var(--at-border-soft)]"],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.includes("PremiumDeskShell")) continue;
  let src = fs.readFileSync(file, "utf8");
  let next = src;
  for (const [re, rep] of REPLACEMENTS) next = next.replace(re, rep);
  if (next !== src) {
    fs.writeFileSync(file, next);
    changed++;
    console.log(path.relative(ROOT, file));
  }
}
console.log(`\nUpdated ${changed} files.`);
