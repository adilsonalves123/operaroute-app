"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { criarLinkComprovante } from "@/lib/comprovantes/client";
import {
  compartilharMidiaRelatorio,
  mensagemCompartilhar,
} from "@/lib/relatorios/compartilhar";
import { formatDateTime } from "@/lib/utils";
import { FileImage, Download, ExternalLink, Loader2, Share2, Trash2 } from "lucide-react";

export interface RelatorioItem {
  id: string;
  foto_url: string;
  previa: boolean;
  created_at: string;
  visita_id: string | null;
  pontos: { nome: string } | null;
}

export function RelatoriosClient({
  relatorios,
  nicho = "cassino",
  podeApagar = false,
}: {
  relatorios: RelatorioItem[];
  nicho?: "cassino" | "fura_fura";
  podeApagar?: boolean;
}) {
  const router = useRouter();
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const [compartilhandoId, setCompartilhandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; text: string } | null>(null);
  const [lista, setLista] = useState(relatorios);

  useEffect(() => {
    setLista(relatorios);
  }, [relatorios]);

  function mostrarFeedback(id: string, text: string) {
    setFeedback({ id, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.id === id ? null : prev));
    }, 2500);
  }

  async function compartilhar(r: RelatorioItem) {
    setCompartilhandoId(r.id);
    const pontoNome = r.pontos?.nome ?? "Ponto";
    try {
      // 1) Preferência: link público do comprovante (melhor para o cliente)
      if (r.visita_id) {
        try {
          const { url, mensagem } = await criarLinkComprovante({ visita_id: r.visita_id });
          if (typeof navigator !== "undefined" && navigator.share) {
            try {
              await navigator.share({
                title: `Comprovante — ${pontoNome}`,
                text: mensagem,
                url,
              });
              return;
            } catch (e) {
              if (e instanceof Error && e.name === "AbortError") return;
            }
          }
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
            mostrarFeedback(r.id, "Link do comprovante copiado — cole no WhatsApp.");
            return;
          }
          window.open(url, "_blank", "noopener,noreferrer");
          return;
        } catch {
          /* cai no compartilhar imagem */
        }
      }

      // 2) Sem visita: compartilha a imagem salva
      const resultado = await compartilharMidiaRelatorio({
        url: r.foto_url,
        titulo: `Comprovante — ${pontoNome}`,
        texto: `Comprovante · ${pontoNome}`,
        fileName: `comprovante-${pontoNome.slice(0, 24)}.png`,
      });
      const msg = mensagemCompartilhar(resultado);
      if (msg) mostrarFeedback(r.id, msg);
    } catch (e) {
      mostrarFeedback(
        r.id,
        e instanceof Error ? e.message : "Não foi possível compartilhar."
      );
    } finally {
      setCompartilhandoId(null);
    }
  }

  async function apagar(id: string) {
    if (!confirm("Apagar esta imagem de relatório? Os dados da visita permanecem.")) return;
    setApagandoId(id);
    try {
      const res = await fetch("/api/relatorios/limpar-midia", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "relatorio", id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "Não foi possível apagar.");
        return;
      }
      setLista((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setApagandoId(null);
    }
  }

  if (lista.length === 0) {
    return (
      <EmptyState
        title="Sem relatórios"
        description={
          nicho === "cassino"
            ? "Relatórios são gerados automaticamente após cada coleta cassino."
            : "Coletas fura-fura com foto aparecem na aba Fura Fura."
        }
        actionLabel={nicho === "cassino" ? "Nova leitura" : "Nova coleta"}
        actionHref={nicho === "cassino" ? "/coletas/nova/cassino" : "/coletas/nova/fura-fura"}
        icon={<FileImage className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lista.map((r) => (
        <div key={r.id} className="glass-card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.foto_url}
            alt={`Relatório ${r.pontos?.nome ?? ""}`}
            className="w-full h-40 object-cover bg-slate-900"
          />
          <div className="p-4 space-y-2">
            <p className="font-medium text-white text-sm">{r.pontos?.nome ?? "Ponto"}</p>
            <p className="text-xs text-at-muted">{formatDateTime(r.created_at)}</p>
            <div className="flex flex-wrap gap-2 pt-1 items-center">
              <button
                type="button"
                disabled={compartilhandoId === r.id}
                onClick={() => void compartilhar(r)}
                className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50"
                title="Compartilhar comprovante"
              >
                {compartilhandoId === r.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Share2 className="h-3 w-3" />
                )}
                Compartilhar
              </button>
              <a
                href={r.foto_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary-neon hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir
              </a>
              <a
                href={r.foto_url}
                download
                className="inline-flex items-center gap-1 text-xs text-at-muted hover:text-white"
              >
                <Download className="h-3 w-3" />
                Baixar
              </a>
              {r.visita_id && (
                <a
                  href={`/coletas/visita/${r.visita_id}`}
                  className="inline-flex items-center gap-1 text-xs text-at-muted hover:text-white"
                >
                  Ver visita
                </a>
              )}
              {podeApagar && (
                <button
                  type="button"
                  disabled={apagandoId === r.id}
                  onClick={() => void apagar(r.id)}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-red-400/90 hover:text-red-300 disabled:opacity-50"
                  title="Apagar imagem"
                >
                  {apagandoId === r.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Apagar
                </button>
              )}
            </div>
            {feedback?.id === r.id && (
              <p className="text-[11px] text-emerald-400/90">{feedback.text}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
