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

export async function buscarEnderecoPorCep(cep: string): Promise<ViaCepResponse | null> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;

  const data = (await res.json()) as ViaCepResponse;
  if (data.erro) return null;
  return data;
}
