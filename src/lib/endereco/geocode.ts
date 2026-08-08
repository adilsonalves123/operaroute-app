import type { EnderecoParsed } from "@/lib/endereco/brasil";
import {
  cepBrValido,
  normalizeCep,
  normalizeUf,
  resolverCepPorEndereco,
} from "@/lib/endereco/brasil";

const NOMINATIM_UA = "OperaRoute/1.0 (operaroute.com.br; suporte@operaroute.com.br)";

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  residential?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
  name?: string;
};

export type EnderecoComGps = EnderecoParsed & {
  latitude: number | null;
  longitude: number | null;
};

/** Remove CEPs do texto para não confundir com número do imóvel. */
function stripCeps(text: string): string {
  return text
    .replace(/\b\d{5}-\d{3}\b/g, " ")
    .replace(/\b\d{8}\b/g, " ");
}

/**
 * Normaliza nº vindo da API (ex.: "123-125", "123 A", "nº 45").
 * Rejeita só CEP completo (01310-100 / 01310100).
 */
export function sanitizarNumeroImovel(raw: string | null | undefined): string {
  let n = (raw ?? "").trim();
  if (!n) return "";

  n = n.replace(/^(n[º°.]?|num(ero)?\.?)\s*/i, "").trim();

  // CEP completo — nunca é número de imóvel
  if (/^\d{5}-\d{3}$/.test(n) || /^\d{8}$/.test(n)) return "";

  // 5 dígitos puros no BR quase sempre é o prefixo do CEP (01310), não o nº da casa
  if (/^\d{5}$/.test(n)) return "";

  // Intervalo "100-102" → usa o primeiro
  const range = n.match(/^(\d{1,5})\s*[-–/]\s*\d{1,5}[A-Za-z]?$/);
  if (range) {
    if (/^\d{5}$/.test(range[1])) return "";
    return range[1];
  }

  // "123A" / "123" / "12/14" — no máx. 4 dígitos (+ letra opcional)
  const simple = n.match(/^(\d{1,4})([A-Za-z])?(?:\/\d{1,4})?$/);
  if (simple) {
    return `${simple[1]}${simple[2] ?? ""}`;
  }

  // Pega primeiro bloco numérico (1–4 dígitos) — 5+ costuma ser CEP
  const embedded = n.match(/(?<!\d)(\d{1,4})(?!\d)/);
  if (embedded) {
    const digits = embedded[1];
    const asCepStart = new RegExp(`(?<!\\d)${digits}-\\d{3}(?!\\d)`);
    if (asCepStart.test(String(raw))) return "";
    return digits;
  }

  if (/^s\/?n\.?$/i.test(n)) return "S/N";
  return "";
}

export function isNumeroImovelValido(raw: string | null | undefined): boolean {
  return Boolean(sanitizarNumeroImovel(raw));
}

/**
 * Extrai nº de textos tipo "Rua X, 123 - Centro" ou "123, Rua X, Cidade".
 * Remove CEPs antes — evita preencher Número com "01310" de "01310-100".
 */
export function extrairNumeroTexto(...texts: (string | null | undefined)[]): string {
  for (const raw of texts) {
    const original = (raw ?? "").trim();
    if (!original) continue;

    const t = stripCeps(original).replace(/\s+/g, " ").trim();
    if (!t) continue;

    const patterns: RegExp[] = [
      /^(\d{1,4}[A-Za-z]?)\s*,/,
      /,\s*n[º°.]?\s*(\d{1,4}[A-Za-z]?)\b/i,
      /\bn[º°.]?\s*(\d{1,4}[A-Za-z]?)\b/i,
      /,\s*(\d{1,4}[A-Za-z]?)\s*,/,
      /,\s*(\d{1,4}[A-Za-z]?)\s*[-–]/,
      /\s+(\d{1,4}[A-Za-z]?)\s*[-–]\s*[A-Za-zÀ-ú]/,
    ];

    for (const re of patterns) {
      const m = t.match(re);
      const candidate = sanitizarNumeroImovel(m?.[1]);
      if (candidate) return candidate;
    }
  }
  return "";
}

function pickCidade(addr: NominatimAddress): string {
  const local =
    addr.city?.trim() ||
    addr.town?.trim() ||
    addr.village?.trim() ||
    addr.municipality?.trim() ||
    "";
  // Nominatim manda "São Paulo" no state — NÃO pegar 2 letras do fim ("lo")
  const uf = normalizeUf(addr.state) || "";
  if (local && uf) return `${local} - ${uf}`;
  return local || (uf ? uf : "");
}

function pickBairro(addr: NominatimAddress): string {
  return (
    addr.suburb?.trim() ||
    addr.neighbourhood?.trim() ||
    addr.city_district?.trim() ||
    ""
  );
}

function pickRua(addr: NominatimAddress): string {
  return (
    addr.road?.trim() ||
    addr.residential?.trim() ||
    addr.pedestrian?.trim() ||
    ""
  );
}

function ufCurtaFromCidade(cidade: string): string | null {
  const m = cidade.match(/\s-\s*([A-Za-z]{2})\s*$/);
  if (m) return normalizeUf(m[1]);
  return normalizeUf(cidade);
}

/**
 * OSM no Brasil mistura CEP no house_number com frequência
 * (ex.: house_number "01310" + postcode "01310-100").
 */
function numeroSemFragmentoCep(
  houseNumber: string | null | undefined,
  postcode: string | null | undefined
): string {
  const numero = sanitizarNumeroImovel(houseNumber);
  if (!numero) return "";
  const cepDigits = normalizeCep(postcode ?? "");
  const numDigits = numero.replace(/\D/g, "");
  if (
    cepDigits.length === 8 &&
    numDigits.length >= 4 &&
    cepDigits.startsWith(numDigits)
  ) {
    return "";
  }
  return numero;
}

export function mapNominatimToEndereco(
  data: NominatimResult,
  fallbackLat?: number,
  fallbackLng?: number
): EnderecoComGps {
  const addr = data.address ?? {};
  const lat = Number(data.lat);
  const lng = Number(data.lon);
  const numero =
    numeroSemFragmentoCep(addr.house_number, addr.postcode) ||
    extrairNumeroTexto(data.name, data.display_name) ||
    "";

  return {
    // Hint só — o reverseGeocode valida no ViaCEP antes de gravar
    cep: cepBrValido(addr.postcode),
    rua: pickRua(addr),
    numero,
    bairro: pickBairro(addr),
    cidade: pickCidade(addr),
    latitude: Number.isFinite(lat)
      ? lat
      : fallbackLat != null && Number.isFinite(fallbackLat)
        ? fallbackLat
        : null,
    longitude: Number.isFinite(lng)
      ? lng
      : fallbackLng != null && Number.isFinite(fallbackLng)
        ? fallbackLng
        : null,
  };
}

async function nominatimReverse(
  latitude: number,
  longitude: number,
  zoom: number
): Promise<NominatimResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("extratags", "1");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as NominatimResult;
}

type BigDataCloud = {
  streetNumber?: string;
  street?: string;
  streetName?: string;
  locality?: string;
  city?: string;
  principalSubdivisionCode?: string;
  principalSubdivision?: string;
  postcode?: string;
  localityInfo?: {
    administrative?: { name?: string; description?: string; order?: number }[];
  };
};

/** Complementa número (e campos faltantes) — costuma achar house number melhor. */
async function reverseBigDataCloud(
  latitude: number,
  longitude: number
): Promise<Partial<EnderecoComGps>> {
  const url = new URL(
    "https://api.bigdatacloud.net/data/reverse-geocode-client"
  );
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("localityLanguage", "pt");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return {};
  const data = (await res.json()) as BigDataCloud;

  const uf =
    normalizeUf(data.principalSubdivisionCode?.replace(/^BR-/i, "")) ||
    normalizeUf(data.principalSubdivision) ||
    "";
  const cidadeNome = data.city?.trim() || data.locality?.trim() || "";
  const cidade =
    cidadeNome && uf ? `${cidadeNome} - ${uf}` : cidadeNome || "";

  return {
    numero: sanitizarNumeroImovel(data.streetNumber),
    rua: data.streetName?.trim() || data.street?.trim() || "",
    cidade,
    cep: cepBrValido(data.postcode),
  };
}

function mergeEndereco(
  primary: EnderecoComGps,
  extras: Partial<EnderecoComGps>[]
): EnderecoComGps {
  let out = { ...primary };
  for (const e of extras) {
    out = {
      cep: out.cep || e.cep || "",
      rua: out.rua || e.rua || "",
      numero: sanitizarNumeroImovel(out.numero || e.numero),
      bairro: out.bairro || e.bairro || "",
      cidade: out.cidade || e.cidade || "",
      latitude: out.latitude ?? e.latitude ?? null,
      longitude: out.longitude ?? e.longitude ?? null,
    };
  }
  return out;
}

/** GPS → endereço completo (rua, nº, bairro, cidade, CEP). */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<EnderecoComGps | null> {
  // zoom 18 = nível de predio/endereço; 17 como fallback
  const raw18 = await nominatimReverse(latitude, longitude, 18);
  const raw17 =
    !raw18?.address?.house_number && !extrairNumeroTexto(raw18?.display_name)
      ? await nominatimReverse(latitude, longitude, 17)
      : null;

  const baseRaw = raw18 ?? raw17;
  if (!baseRaw?.address && !baseRaw?.display_name) {
    const onlyBdc = await reverseBigDataCloud(latitude, longitude);
    if (!onlyBdc.rua && !onlyBdc.cidade && !onlyBdc.numero) return null;
    let result: EnderecoComGps = {
      cep: "",
      rua: onlyBdc.rua || "",
      numero: sanitizarNumeroImovel(onlyBdc.numero),
      bairro: onlyBdc.bairro || "",
      cidade: onlyBdc.cidade || "",
      latitude,
      longitude,
    };
    if (result.rua && result.cidade) {
      try {
        const cepOk = await resolverCepPorEndereco({
          rua: result.rua,
          bairro: result.bairro,
          cidade: result.cidade,
          uf: ufCurtaFromCidade(result.cidade),
          latitude,
          longitude,
          cepHint: onlyBdc.cep,
        });
        result = { ...result, cep: cepOk };
      } catch {
        // ignore
      }
    }
    return result;
  }

  let result = mapNominatimToEndereco(baseRaw, latitude, longitude);
  if (raw17) {
    result = mergeEndereco(result, [mapNominatimToEndereco(raw17, latitude, longitude)]);
  }

  const cepHintMapa = result.cep;
  result = { ...result, cep: "" };

  // BigDataCloud: rua/cidade; número só se veio do ponto (não busca vizinho)
  let cepHintBdc = "";
  try {
    const bdc = await reverseBigDataCloud(latitude, longitude);
    cepHintBdc = bdc.cep || "";
    result = {
      ...result,
      rua: result.rua || bdc.rua || "",
      cidade: result.cidade || bdc.cidade || "",
      // Mantém nº só se Nominatim já trouxe no ponto; BDC completa se vazio
      numero: sanitizarNumeroImovel(result.numero || bdc.numero),
      cep: "",
    };
  } catch {
    // ignore
  }

  // NÃO busca nº de imóveis vizinhos — GPS impreciso pega casa errada

  // CEP: valida hint do mapa no ViaCEP, senão busca por rua+cidade
  result.cep = "";
  if (result.rua && result.cidade) {
    try {
      const cepOk = await resolverCepPorEndereco({
        rua: result.rua,
        bairro: result.bairro,
        cidade: result.cidade,
        uf: ufCurtaFromCidade(result.cidade),
        latitude,
        longitude,
        cepHint: cepHintMapa || cepHintBdc,
      });
      result = {
        ...result,
        cep: cepOk,
        numero: numeroSemFragmentoCep(result.numero, cepOk),
      };
    } catch {
      result.cep = "";
    }
  }

  result.numero = numeroSemFragmentoCep(result.numero, result.cep);
  result.cep = cepBrValido(result.cep);
  result.latitude = latitude;
  result.longitude = longitude;
  return result;
}

/** Endereço texto → GPS (+ completa campos quando possível). */
export async function forwardGeocode(
  query: string
): Promise<EnderecoComGps | null> {
  const q = query.trim();
  if (q.length < 5) return null;

  const numeroNaQuery =
    sanitizarNumeroImovel(extrairNumeroTexto(q)) ||
    (() => {
      // "Rua X 123" / "Rua X, 123"
      const m = q.match(/(?:,\s*|\s+)(\d{1,5}[A-Za-z]?)\s*(?:,|$)/);
      return sanitizarNumeroImovel(m?.[1]);
    })();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "br");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": NOMINATIM_UA },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const list = (await res.json()) as NominatimResult[];

  // Se a pessoa digitou nº, prefere resultado com esse nº; senão NÃO inventa nº de outro prédio
  const withNum = numeroNaQuery
    ? list?.find((i) => {
        const n =
          numeroSemFragmentoCep(i.address?.house_number, i.address?.postcode) ||
          extrairNumeroTexto(i.name, i.display_name);
        return n === numeroNaQuery;
      }) ??
      list?.find(
        (i) =>
          i.address?.house_number ||
          extrairNumeroTexto(i.name, i.display_name)
      ) ??
      list?.[0]
    : list?.[0];
  if (!withNum) return null;

  const mapped = mapNominatimToEndereco(withNum);
  if (numeroNaQuery) {
    mapped.numero =
      sanitizarNumeroImovel(mapped.numero) || numeroNaQuery;
  } else {
    // Sem nº na busca: limpa qualquer house_number aleatório do primeiro resultado
    mapped.numero = "";
  }
  return mapped;
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GPS não disponível neste dispositivo."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

export async function reverseGeocodeViaApi(
  latitude: number,
  longitude: number
): Promise<EnderecoComGps | null> {
  const res = await fetch(
    `/api/endereco/geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
    { credentials: "include" }
  );
  if (!res.ok) return null;
  return (await res.json()) as EnderecoComGps;
}

export async function forwardGeocodeViaApi(
  query: string
): Promise<EnderecoComGps | null> {
  const res = await fetch(
    `/api/endereco/geocode?q=${encodeURIComponent(query)}`,
    { credentials: "include" }
  );
  if (!res.ok) return null;
  return (await res.json()) as EnderecoComGps;
}

export async function capturarGpsSomente(): Promise<{
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}> {
  const pos = await getCurrentPosition();
  const accuracy = pos.coords.accuracy;
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracyM: Number.isFinite(accuracy) ? accuracy : null,
  };
}

export async function preencherEnderecoComGps(opts?: {
  /** Se false (padrão), não devolve nº — GPS costuma apontar o prédio vizinho. */
  incluirNumero?: boolean;
}): Promise<EnderecoComGps & { accuracyM: number | null }> {
  const gps = await capturarGpsSomente();
  const { latitude, longitude, accuracyM } = gps;
  const endereco = await reverseGeocodeViaApi(latitude, longitude);
  const incluirNumero = opts?.incluirNumero === true;
  if (!endereco) {
    return {
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      latitude,
      longitude,
      accuracyM,
    };
  }
  return {
    ...endereco,
    numero: incluirNumero ? endereco.numero : "",
    latitude,
    longitude,
    accuracyM,
  };
}

/** Preenche endereço a partir de lat/lng já gravados (sem capturar GPS de novo). */
export async function preencherEnderecoDeCoords(
  latitude: number,
  longitude: number,
  opts?: { incluirNumero?: boolean }
): Promise<EnderecoComGps> {
  const endereco = await reverseGeocodeViaApi(latitude, longitude);
  if (!endereco) {
    return {
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      latitude,
      longitude,
    };
  }
  return {
    ...endereco,
    numero: opts?.incluirNumero === true ? endereco.numero : "",
    latitude,
    longitude,
  };
}
