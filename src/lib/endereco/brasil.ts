export type EnderecoParsed = {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
};

export type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

/** Nome do estado (Nominatim) → UF. */
const UF_POR_NOME: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** "São Paulo" | "SP" | "BR-SP" → "SP" */
export function normalizeUf(raw: string | null | undefined): string | null {
  let t = (raw ?? "").trim();
  if (!t) return null;
  t = t.replace(/^BR-/i, "");
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  const key = semAcento(t).toLowerCase().replace(/\s+/g, " ").trim();
  return UF_POR_NOME[key] ?? null;
}

/** Separa "Cidade - UF" (e evita tratar "Paulo" como UF "lo"). */
export function parseCidadeUf(cidadeCampo: string): {
  cidade: string;
  uf: string | null;
} {
  const raw = cidadeCampo.trim();
  if (!raw) return { cidade: "", uf: null };

  const m = raw.match(/^(.+?)\s*[-–/]\s*(.+)$/);
  if (m) {
    const left = m[1].trim();
    const right = m[2].trim();
    const uf = normalizeUf(right);
    if (uf) return { cidade: left, uf };
  }

  return { cidade: raw, uf: null };
}

export function parseEnderecoSalvo(
  endereco: string | null,
  bairro: string | null,
  cidade: string | null
): Pick<EnderecoParsed, "rua" | "numero"> {
  if (!endereco?.trim()) return { rua: "", numero: "" };
  const trimmed = endereco.trim();
  const comma = trimmed.match(/^(.+?),\s*([^,]+)$/);
  if (comma) {
    return { rua: comma[1].trim(), numero: comma[2].trim() };
  }
  const trailingNum = trimmed.match(/^(.+?)\s+(\d+\w*)\s*$/);
  if (trailingNum && !bairro && !cidade) {
    return { rua: trailingNum[1].trim(), numero: trailingNum[2].trim() };
  }
  return { rua: trimmed, numero: "" };
}

export function formatEnderecoSalvo(rua: string, numero: string): string | null {
  const r = rua.trim();
  const n = numero.trim();
  if (!r && !n) return null;
  if (r && n) return `${r}, ${n}`;
  return r || n;
}

export function normalizeCep(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

export function formatCepDisplay(cep: string): string {
  const d = normalizeCep(cep);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Só aceita CEP BR completo (8 dígitos). Descarta postcode incompleto do mapa. */
export function cepBrValido(raw: string | null | undefined): string {
  const d = normalizeCep(raw ?? "");
  if (d.length !== 8) return "";
  // Genéricos tipo 00000000
  if (/^0+$/.test(d)) return "";
  return formatCepDisplay(d);
}

export async function buscarEnderecoPorCep(cep: string): Promise<ViaCepResponse | null> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) return null;
  return data;
}

/** Remove prefixo de tipo de logradouro para ampliar match no ViaCEP. */
function logradouroParaBusca(rua: string): string {
  return rua
    .replace(
      /^(rua|r\.|avenida|av\.|alameda|al\.|travessa|trav\.|rodovia|rod\.|estrada|est\.|praça|praca|pç\.|largo|viela|beço|beco)\s+/i,
      ""
    )
    .trim();
}

function normBairro(s: string): string {
  return semAcento(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

async function coordsDoCep(
  digits: string
): Promise<{ lat: number; lng: number } | null> {
  // BrasilAPI v2 (preferível) → AwesomeAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        location?: { coordinates?: { latitude?: string; longitude?: string } };
      };
      const lat = Number(data.location?.coordinates?.latitude);
      const lng = Number(data.location?.coordinates?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // fallback
  }

  try {
    const res = await fetch(`https://cep.awesomeapi.com.br/json/${digits}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const geo = (await res.json()) as { lat?: string; lng?: string };
    const lat = Number(geo.lat);
    const lng = Number(geo.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  } catch {
    // ignore
  }
  return null;
}

async function viaCepPorLogradouro(
  uf: string,
  cidade: string,
  logradouro: string
): Promise<ViaCepResponse[]> {
  if (logradouro.length < 3) return [];
  const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(logradouro)}/json/`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as ViaCepResponse[] | ViaCepResponse;
    const list = Array.isArray(data) ? data : data?.erro ? [] : [data];
    return list.filter((c) => c?.cep && !c.erro);
  } catch {
    return [];
  }
}

function tokensRua(s: string): string[] {
  return normBairro(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^(rua|avenida|travessa|alameda|rodovia|estrada)$/.test(t));
}

function ruasParecidas(a: string, b: string): boolean {
  const ta = tokensRua(a);
  const tb = tokensRua(b);
  if (!ta.length || !tb.length) return false;
  const setB = new Set(tb);
  const hit = ta.filter((t) => setB.has(t)).length;
  return hit >= Math.min(2, ta.length, tb.length) || ta[0] === tb[0];
}

/** Valida um CEP sugerido pelo mapa no ViaCEP (cidade/rua batem). */
export async function validarCepHint(opts: {
  cepHint?: string | null;
  rua?: string;
  bairro?: string;
  cidade: string;
  uf?: string | null;
}): Promise<string> {
  const cep = cepBrValido(opts.cepHint);
  if (!cep) return "";
  const data = await buscarEnderecoPorCep(cep);
  if (!data) return "";

  const parsed = parseCidadeUf(opts.cidade);
  const uf = normalizeUf(opts.uf) || parsed.uf;
  if (data.uf && uf && data.uf.toUpperCase() !== uf) return "";

  const cidadeData = normBairro(data.localidade ?? "");
  const cidadeForm = normBairro(parsed.cidade);
  if (
    cidadeData &&
    cidadeForm &&
    cidadeData !== cidadeForm &&
    !cidadeData.includes(cidadeForm) &&
    !cidadeForm.includes(cidadeData)
  ) {
    return "";
  }

  const ruaForm = opts.rua?.trim() ?? "";
  const ruaData = data.logradouro?.trim() ?? "";
  if (ruaForm && ruaData && ruasParecidas(ruaForm, ruaData)) {
    return cep;
  }

  // CEP de área (sem logradouro) — aceita se bairro bater
  if (!ruaData && opts.bairro && data.bairro) {
    const b1 = normBairro(opts.bairro);
    const b2 = normBairro(data.bairro);
    if (b1 && b2 && (b1 === b2 || b1.includes(b2) || b2.includes(b1))) return cep;
  }

  // Sem rua no formulário ainda, mas cidade/UF ok
  if (!ruaForm && cidadeData && cidadeForm) return cep;

  // Rua no form mas ViaCEP sem logradouro: ainda útil se cidade ok
  if (ruaForm && !ruaData && cidadeData && cidadeForm) return cep;

  return "";
}

async function escolherCepMaisProximo(
  candidatos: ViaCepResponse[],
  lat: number,
  lng: number
): Promise<string> {
  let best: { cep: string; km: number } | null = null;
  for (const c of candidatos.slice(0, 20)) {
    const digits = normalizeCep(c.cep ?? "");
    if (digits.length !== 8) continue;
    const coords = await coordsDoCep(digits);
    if (!coords) continue;
    const km = distKm(lat, lng, coords.lat, coords.lng);
    if (!best || km < best.km) best = { cep: digits, km };
  }
  // Centroide de CEP pode ficar a alguns km; até ~8 km ainda é útil
  if (best && best.km <= 8) return formatCepDisplay(best.cep);
  return best ? formatCepDisplay(best.cep) : "";
}

/**
 * Resolve CEP brasileiro:
 * 1) valida hint do mapa no ViaCEP
 * 2) busca por rua+cidade no ViaCEP
 * 3) com GPS, escolhe o mais perto
 */
export async function resolverCepPorEndereco(opts: {
  rua: string;
  bairro?: string;
  cidade: string;
  uf?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Postcode do OSM/BDC — só entra se o ViaCEP confirmar */
  cepHint?: string | null;
}): Promise<string> {
  const parsed = parseCidadeUf(opts.cidade);
  const uf = normalizeUf(opts.uf) || parsed.uf;
  const cidade = parsed.cidade;
  const ruaFull = opts.rua.trim();
  const ruaCurta = logradouroParaBusca(ruaFull);

  // 1) Hint do mapa validado (recupera o caso comum em que o OSM acertou)
  const doHint = await validarCepHint({
    cepHint: opts.cepHint,
    rua: ruaFull,
    bairro: opts.bairro,
    cidade: opts.cidade,
    uf,
  });
  if (doHint) return doHint;

  if (!uf || !cidade || ruaCurta.length < 3) return "";

  const cidadesTry = [cidade, semAcento(cidade)].filter(
    (v, i, arr) => v.length >= 2 && arr.indexOf(v) === i
  );
  // Variantes do logradouro (ViaCEP é exigente no nome)
  const tokens = tokensRua(ruaCurta);
  const logTry = [
    ruaFull,
    ruaCurta,
    tokens.slice(0, 3).join(" "),
    tokens.slice(0, 2).join(" "),
    tokens[0] ?? "",
  ].filter((v, i, arr) => v.length >= 3 && arr.indexOf(v) === i);

  let candidatos: ViaCepResponse[] = [];
  outer: for (const cid of cidadesTry) {
    for (const log of logTry) {
      const ok = await viaCepPorLogradouro(uf, cid, log);
      if (ok.length) {
        candidatos = ok;
        break outer;
      }
    }
  }

  if (!candidatos.length) return "";

  const bairroNorm = normBairro(opts.bairro ?? "");
  if (bairroNorm) {
    const noBairro = candidatos.filter((c) => {
      const b = normBairro(c.bairro ?? "");
      return b && (b.includes(bairroNorm) || bairroNorm.includes(b));
    });
    if (noBairro.length === 1) return cepBrValido(noBairro[0].cep);
    if (noBairro.length > 1) candidatos = noBairro;
  }

  const lat = opts.latitude;
  const lng = opts.longitude;
  if (
    candidatos.length > 0 &&
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    const perto = await escolherCepMaisProximo(candidatos, lat, lng);
    if (perto) return perto;
  }

  if (candidatos.length === 1) return cepBrValido(candidatos[0].cep);

  // Vários na mesma rua/bairro sem geo: usa o primeiro do bairro (melhor que vazio)
  return cepBrValido(candidatos[0].cep);
}
