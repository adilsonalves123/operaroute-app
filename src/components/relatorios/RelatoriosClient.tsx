"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { FileImage, Download, ExternalLink } from "lucide-react";

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
}: {
  relatorios: RelatorioItem[];
  nicho?: "cassino" | "fura_fura";
}) {
  if (relatorios.length === 0) {
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
      {relatorios.map((r) => (
        <div key={r.id} className="glass-card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r.foto_url}
            alt={`Relatório ${r.pontos?.nome ?? ""}`}
            className="w-full h-40 object-cover bg-slate-900"
          />
          <div className="p-4 space-y-2">
            <p className="font-medium text-white text-sm">{r.pontos?.nome ?? "Ponto"}</p>
            <p className="text-xs text-slate-400">{formatDateTime(r.created_at)}</p>
            <div className="flex gap-2 pt-1">
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
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <Download className="h-3 w-3" />
                Baixar
              </a>
              {r.visita_id && (
                <a
                  href={`/coletas/visita/${r.visita_id}`}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white ml-auto"
                >
                  Ver visita
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
