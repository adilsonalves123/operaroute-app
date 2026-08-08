import { parseEnderecoSalvo } from "@/lib/endereco/brasil";
import type { PontoStatus } from "@/lib/types/database";
import {
  getComissaoPercentualNicho,
  nichosComissaoVisiveis,
  type NichoComissaoKey,
  parseComissaoPorNicho,
} from "@/lib/pontos/comissao-nicho";
import type { Nicho } from "@/lib/types/database";

export type PontoFormSource = {
  nome: string;
  responsavel: string | null;
  whatsapp: string | null;
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  comissao_percentual: number;
  comissao_por_nicho?: unknown;
  consignado_modo_comissao?: string | null;
  observacoes: string | null;
  foto_url?: string | null;
};

export type PontoFormValues = {
  nome: string;
  responsavel: string;
  whatsapp: string;
  cidade: string;
  bairro: string;
  endereco: string;
  cep: string;
  rua: string;
  numero: string;
  latitude: string;
  longitude: string;
  status: PontoStatus;
  /** Legado — espelha cassino/fura ao salvar */
  comissao_percentual: string;
  comissao_por_nicho: Record<NichoComissaoKey, string>;
  consignado_modo_comissao: "percentual" | "tabela";
  observacoes: string;
};

function emptyComissaoMap(legado = "0"): Record<NichoComissaoKey, string> {
  return {
    maquinas_cassino: legado,
    fura_fura: legado,
    ursinho: legado,
    diversao: legado,
    bolinha: legado,
    consignado: "0",
  };
}

export function valuesFromPonto(
  p: PontoFormSource,
  nichosAtivos?: Nicho[]
): PontoFormValues {
  const { rua, numero } = parseEnderecoSalvo(p.endereco, p.bairro, p.cidade);
  const legado = String(p.comissao_percentual ?? 0);
  const map = parseComissaoPorNicho(p.comissao_por_nicho);
  const comissao_por_nicho = emptyComissaoMap(legado);
  for (const key of nichosComissaoVisiveis(nichosAtivos)) {
    comissao_por_nicho[key] = String(
      map[key] ?? getComissaoPercentualNicho(p, key)
    );
  }
  // Sempre preenche consignado explicitamente
  comissao_por_nicho.consignado = String(
    map.consignado ?? getComissaoPercentualNicho(p, "consignado")
  );

  return {
    nome: p.nome,
    responsavel: p.responsavel ?? "",
    whatsapp: p.whatsapp ?? "",
    cidade: p.cidade ?? "",
    bairro: p.bairro ?? "",
    endereco: p.endereco ?? "",
    cep: "",
    rua,
    numero,
    latitude:
      p.latitude != null && Number.isFinite(Number(p.latitude))
        ? String(Number(p.latitude))
        : "",
    longitude:
      p.longitude != null && Number.isFinite(Number(p.longitude))
        ? String(Number(p.longitude))
        : "",
    status: (p.status as PontoStatus) || "ativo",
    comissao_percentual: legado,
    comissao_por_nicho,
    consignado_modo_comissao:
      p.consignado_modo_comissao === "tabela" ? "tabela" : "percentual",
    observacoes: p.observacoes ?? "",
  };
}

export const emptyPontoFormValues: PontoFormValues = {
  nome: "",
  responsavel: "",
  whatsapp: "",
  cidade: "",
  bairro: "",
  endereco: "",
  cep: "",
  rua: "",
  numero: "",
  latitude: "",
  longitude: "",
  status: "ativo",
  comissao_percentual: "0",
  comissao_por_nicho: emptyComissaoMap("0"),
  consignado_modo_comissao: "tabela",
  observacoes: "",
};
