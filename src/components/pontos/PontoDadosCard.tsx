"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { parseEnderecoSalvo } from "@/lib/endereco/brasil";
import type { Nicho, PontoStatus } from "@/lib/types/database";
import { formatDate, cn } from "@/lib/utils";
import {
  LABEL_COMISSAO_NICHO,
  buildComissaoPorNichoPayload,
  getComissaoPercentualNicho,
  nichosComissaoVisiveis,
  type NichoComissaoKey,
} from "@/lib/pontos/comissao-nicho";

const STATUS_LABELS: Record<PontoStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  retirado: "Retirado",
  inadimplente: "Inadimplente",
};

interface PontoDadosCardProps {
  pontoId: string;
  nome: string;
  responsavel: string | null;
  whatsapp: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  status: string;
  observacoes: string | null;
  ultimaColeta: string | null;
  createdAt: string;
  comissaoPercentual: number;
  comissaoPorNicho?: unknown;
  nichosAtivos?: Nicho[];
}

function DadoItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-at-muted mb-0.5">{label}</p>
      <div className="text-sm text-white break-words">{children}</div>
    </div>
  );
}

function valorOuTraco(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

function initialComissoes(
  comissaoPercentual: number,
  comissaoPorNicho: unknown,
  nichosAtivos?: Nicho[]
): Record<NichoComissaoKey, string> {
  const ponto = {
    comissao_percentual: comissaoPercentual,
    comissao_por_nicho: comissaoPorNicho,
  };
  const out = {
    maquinas_cassino: "0",
    fura_fura: "0",
    ursinho: "0",
    diversao: "0",
    bolinha: "0",
    consignado: "0",
  } as Record<NichoComissaoKey, string>;
  for (const key of nichosComissaoVisiveis(nichosAtivos)) {
    out[key] = String(getComissaoPercentualNicho(ponto, key));
  }
  return out;
}

export function PontoDadosCard({
  pontoId,
  nome,
  responsavel,
  whatsapp,
  endereco,
  bairro,
  cidade,
  status,
  observacoes,
  ultimaColeta,
  createdAt,
  comissaoPercentual,
  comissaoPorNicho,
  nichosAtivos,
}: PontoDadosCardProps) {
  const router = useRouter();
  const nichos = nichosComissaoVisiveis(nichosAtivos);
  const [comissoes, setComissoes] = useState(() =>
    initialComissoes(comissaoPercentual, comissaoPorNicho, nichosAtivos)
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const { rua, numero } = parseEnderecoSalvo(endereco, bairro, cidade);
  const enderecoLinha = [rua, numero].filter(Boolean).join(", ");
  const statusLabel = STATUS_LABELS[status as PontoStatus] ?? status ?? "—";
  const whatsappDigits = whatsapp?.replace(/\D/g, "") ?? "";

  async function salvarComissoes() {
    setLoading(true);
    setMsg("");
    try {
      const map = buildComissaoPorNichoPayload(comissoes, nichosAtivos);
      const legado =
        map.maquinas_cassino ?? map.fura_fura ?? Object.values(map)[0] ?? 0;
      const res = await fetch(`/api/pontos/${pontoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          comissao_percentual: legado,
          comissao_por_nicho: map,
          consignado_modo_comissao: "tabela",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Salvo!");
        router.refresh();
      } else {
        setMsg(data.error ?? "Erro ao salvar");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="glass-card p-6 space-y-5">
        <h2 className="font-semibold text-white">Dados do ponto</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <DadoItem label="Nome">{valorOuTraco(nome)}</DadoItem>
          <DadoItem label="Status">{statusLabel}</DadoItem>
          <DadoItem label="Responsável">{valorOuTraco(responsavel)}</DadoItem>
          <DadoItem label="WhatsApp">
            {whatsappDigits ? (
              <a
                href={`https://wa.me/55${whatsappDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 hover:underline"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                {valorOuTraco(whatsapp)}
              </a>
            ) : (
              "—"
            )}
          </DadoItem>
          <DadoItem label="Endereço" className="sm:col-span-2">
            {valorOuTraco(enderecoLinha || endereco)}
          </DadoItem>
          <DadoItem label="Bairro">{valorOuTraco(bairro)}</DadoItem>
          <DadoItem label="Cidade">{valorOuTraco(cidade)}</DadoItem>
          <DadoItem label="Última coleta">
            {ultimaColeta ? formatDate(ultimaColeta) : "Nunca"}
          </DadoItem>
          <DadoItem label="Cadastrado em">
            {createdAt ? formatDate(createdAt) : "—"}
          </DadoItem>
        </div>

        {observacoes?.trim() && (
          <div className="border-t border-slate-800 pt-4">
            <p className="text-xs text-at-muted mb-1">Observações</p>
            <p className="text-sm text-at-primary/85 whitespace-pre-wrap">{observacoes}</p>
          </div>
        )}

        <div className="border-t border-slate-800 pt-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-white">Comissão por nicho (%)</p>
            <p className="mt-0.5 text-xs text-at-muted">
              Configure o percentual de cada nicho neste ponto.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
            {nichos
              .filter((key) => key !== "consignado")
              .map((key) => (
              <FormInput
                key={key}
                label={`${LABEL_COMISSAO_NICHO[key]} (%)`}
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={comissoes[key] ?? "0"}
                onChange={(e) =>
                  setComissoes((prev) => ({ ...prev, [key]: e.target.value }))
                }
              />
            ))}
          </div>
          {nichos.includes("consignado") && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5 text-xs text-at-muted max-w-xl">
              <p className="font-medium text-amber-200/90">Consignado</p>
              <p className="mt-0.5">
                Usa tabela do produto (custo, valor final, repasse ao cliente) — não percentual.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={salvarComissoes}
            disabled={loading}
            className="rounded-lg bg-primary-neon px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar comissões"}
          </button>
          {msg && <p className="text-xs text-at-muted">{msg}</p>}
        </div>
      </div>

      <LoadingOverlay show={loading} message="Salvando comissões..." />
    </>
  );
}
