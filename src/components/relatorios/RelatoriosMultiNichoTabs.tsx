"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  compartilharMidiaRelatorio,
  mensagemCompartilhar,
} from "@/lib/relatorios/compartilhar";
import { FileImage, Download, ExternalLink, Loader2, Share2, Trash2 } from "lucide-react";
import { RelatoriosClient, type RelatorioItem } from "@/components/relatorios/RelatoriosClient";
import type { DashboardNichoId } from "@/lib/dashboard-nichos-ativos";

export type ColetaFotoRelatorio = {
  id: string;
  foto_url: string | null;
  created_at: string;
  lucro_real: number | null;
  valor_liquido: number | null;
  quantidade_furos?: number | null;
  pontos: { nome: string } | null;
};

const TAB_LABELS: Record<DashboardNichoId, string> = {
  maquinas_cassino: "Cassino",
  fura_fura: "Fura Fura",
  ursinho: "Ursinho",
  diversao: "Diversão",
  bolinha: "Bolinha",
  consignado: "Consignado",
};

export function RelatoriosMultiNichoTabs({
  nichos,
  cassino = [],
  furaColetas = [],
  ursinhoColetas = [],
  diversaoColetas = [],
  bolinhaColetas = [],
  podeApagar = false,
}: {
  nichos: DashboardNichoId[];
  cassino?: RelatorioItem[];
  furaColetas?: ColetaFotoRelatorio[];
  ursinhoColetas?: ColetaFotoRelatorio[];
  diversaoColetas?: ColetaFotoRelatorio[];
  bolinhaColetas?: ColetaFotoRelatorio[];
  podeApagar?: boolean;
}) {
  const [tab, setTab] = useState<DashboardNichoId | null>(nichos[0] ?? null);

  if (nichos.length === 0 || !tab) {
    return (
      <EmptyState
        title="Nenhum nicho ativo"
        description="Ative um nicho em Configurações para ver relatórios de coleta."
        actionLabel="Configurações"
        actionHref="/configuracoes"
        icon={<FileImage className="h-8 w-8" />}
      />
    );
  }

  if (nichos.length === 1 && nichos[0] === "maquinas_cassino") {
    return <RelatoriosClient relatorios={cassino} nicho="cassino" podeApagar={podeApagar} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6 border-b border-slate-800">
        {nichos.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition",
              tab === id
                ? "border-primary-neon text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>

      {tab === "maquinas_cassino" && (
        <RelatoriosClient relatorios={cassino} nicho="cassino" podeApagar={podeApagar} />
      )}
      {tab === "fura_fura" && (
        <ColetasFotoRelatoriosLista
          coletas={furaColetas}
          emptyTitle="Sem coletas fura-fura"
          emptyHref="/coletas/nova/fura-fura"
          detalheHref={(id) => `/coletas/fura-fura/${id}`}
          extraLine={(c) => `${c.quantidade_furos ?? 0} furos`}
          podeApagar={podeApagar}
        />
      )}
      {tab === "ursinho" && (
        <ColetasFotoRelatoriosLista
          coletas={ursinhoColetas}
          emptyTitle="Sem coletas ursinho"
          emptyHref="/coletas/nova/ursinho"
          detalheHref={(id) => `/coletas/ursinho/${id}`}
          podeApagar={podeApagar}
        />
      )}
      {tab === "diversao" && (
        <ColetasFotoRelatoriosLista
          coletas={diversaoColetas}
          emptyTitle="Sem coletas de diversão"
          emptyHref="/coletas/nova/diversao"
          detalheHref={(id) => `/coletas/diversao/${id}`}
          podeApagar={podeApagar}
        />
      )}
      {tab === "bolinha" && (
        <ColetasFotoRelatoriosLista
          coletas={bolinhaColetas}
          emptyTitle="Sem coletas de bolinha"
          emptyHref="/coletas/nova/bolinha"
          detalheHref={(id) => `/coletas/bolinha/${id}`}
          podeApagar={podeApagar}
        />
      )}
    </div>
  );
}

function ColetasFotoRelatoriosLista({
  coletas: initial,
  emptyTitle,
  emptyHref,
  detalheHref,
  extraLine,
  podeApagar,
}: {
  coletas: ColetaFotoRelatorio[];
  emptyTitle: string;
  emptyHref: string;
  detalheHref: (id: string) => string;
  extraLine?: (c: ColetaFotoRelatorio) => string;
  podeApagar?: boolean;
}) {
  const router = useRouter();
  const [coletas, setColetas] = useState(initial);
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const [compartilhandoId, setCompartilhandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    setColetas(initial);
  }, [initial]);

  function mostrarFeedback(id: string, text: string) {
    setFeedback({ id, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.id === id ? null : prev));
    }, 2500);
  }

  async function compartilhar(c: ColetaFotoRelatorio) {
    if (!c.foto_url) return;
    setCompartilhandoId(c.id);
    const pontoNome = c.pontos?.nome ?? "Ponto";
    try {
      const resultado = await compartilharMidiaRelatorio({
        url: c.foto_url,
        titulo: `Relatório — ${pontoNome}`,
        texto: `Relatório de coleta · ${pontoNome}`,
        fileName: `relatorio-${pontoNome.slice(0, 24)}.png`,
      });
      const msg = mensagemCompartilhar(resultado);
      if (msg) mostrarFeedback(c.id, msg);
    } finally {
      setCompartilhandoId(null);
    }
  }

  async function apagarFoto(id: string) {
    if (!confirm("Apagar só a foto desta coleta? Os valores permanecem no histórico.")) return;
    setApagandoId(id);
    try {
      const res = await fetch("/api/relatorios/limpar-midia", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "coleta", id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Não foi possível apagar.");
        return;
      }
      setColetas((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } finally {
      setApagandoId(null);
    }
  }

  if (coletas.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description="Coletas com foto aparecem aqui. Faça uma nova coleta para registrar."
        actionLabel="Nova coleta"
        actionHref={emptyHref}
        icon={<FileImage className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {coletas.map((c) => {
        const lucro = Number(c.lucro_real ?? c.valor_liquido ?? 0);
        return (
          <div key={c.id} className="glass-card overflow-hidden">
            {c.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.foto_url}
                alt={`Coleta ${c.pontos?.nome ?? ""}`}
                className="h-40 w-full bg-slate-900 object-cover"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-slate-900 text-slate-600">
                <FileImage className="h-10 w-10" />
              </div>
            )}
            <div className="space-y-2 p-4">
              <p className="text-sm font-medium text-white">{c.pontos?.nome ?? "Ponto"}</p>
              <p className="text-xs text-slate-400">{formatDateTime(c.created_at)}</p>
              <p className="text-xs text-green-400">
                Lucro {formatCurrency(lucro)}
                {extraLine ? ` · ${extraLine(c)}` : ""}
              </p>
              <div className="flex flex-wrap gap-2 pt-1 items-center">
                {c.foto_url && (
                  <>
                    <button
                      type="button"
                      disabled={compartilhandoId === c.id}
                      onClick={() => void compartilhar(c)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
                      title="Compartilhar"
                    >
                      {compartilhandoId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Share2 className="h-3 w-3" />
                      )}
                      Compartilhar
                    </button>
                    <a
                      href={c.foto_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary-neon hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir foto
                    </a>
                    <a
                      href={c.foto_url}
                      download
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                    >
                      <Download className="h-3 w-3" />
                      Baixar
                    </a>
                    {podeApagar && (
                      <button
                        type="button"
                        disabled={apagandoId === c.id}
                        onClick={() => void apagarFoto(c.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-400/90 hover:text-red-300 disabled:opacity-50"
                      >
                        {apagandoId === c.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Apagar foto
                      </button>
                    )}
                  </>
                )}
                <Link
                  href={detalheHref(c.id)}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  Ver coleta
                </Link>
              </div>
              {feedback?.id === c.id && (
                <p className="text-[11px] text-emerald-400/90">{feedback.text}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** @deprecated use ColetaFotoRelatorio */
export type ColetaFuraRelatorio = ColetaFotoRelatorio;
