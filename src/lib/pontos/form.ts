import { parseEnderecoSalvo } from "@/lib/endereco/brasil";
import type { PontoStatus } from "@/lib/types/database";

export type PontoFormSource = {
  nome: string;
  responsavel: string | null;
  whatsapp: string | null;
  cidade: string | null;
  bairro: string | null;
  endereco: string | null;
  status: string;
  comissao_percentual: number;
  observacoes: string | null;
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
  status: PontoStatus;
  comissao_percentual: string;
  observacoes: string;
};

export function valuesFromPonto(p: PontoFormSource): PontoFormValues {
  const { rua, numero } = parseEnderecoSalvo(p.endereco, p.bairro, p.cidade);
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
    status: (p.status as PontoStatus) || "ativo",
    comissao_percentual: String(p.comissao_percentual ?? 0),
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
  status: "ativo",
  comissao_percentual: "0",
  observacoes: "",
};
