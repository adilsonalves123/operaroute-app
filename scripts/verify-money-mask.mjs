function formatMoneyInput(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseInt(d, 10) / 100);
}

function parseMoneyInput(v) {
  const c = String(v).replace(/[^\d,.-]/g, "");
  if (!c) return 0;
  if (c.includes(",")) return parseFloat(c.replace(/\./g, "").replace(",", ".")) || 0;
  return parseFloat(c) || 0;
}

const cases = [
  ["350", "3,50", 3.5],
  ["3500", "35,00", 35],
  ["35000", "350,00", 350],
  ["123456", "1.234,56", 1234.56],
  ["", "", 0],
];

for (const [raw, expFmt, expNum] of cases) {
  const f = formatMoneyInput(raw);
  const n = parseMoneyInput(f || "0");
  if (f !== expFmt || Math.abs(n - expNum) > 0.001) {
    console.error("FAIL", { raw, f, expFmt, n, expNum });
    process.exit(1);
  }
}
console.log("ok");
