"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FileImage, Download, ExternalLink } from "lucide-react";
import { RelatoriosClient, type RelatorioItem } from "@/components/relatorios/RelatoriosClient";

export type ColetaFuraRelatorio = {
  id: string;
  foto_url: string | null;
  created_at: string;
  lucro_real: number | null;
  valor_liquido: number | null;
  quantidade_furos: number | null;
  pontos: { nome: string } | null;
};

type Tab = "cassino" | "fura_fura";

export function RelatoriosMultiNichoTabs({
  cassino,
  furaColetas,
  showFura,
}: {
  cassino: RelatorioItem[];
  furaColetas: ColetaFuraRelatorio[];
  showFura: boolean;
}) {
  const [tab, setTab] = useState<Tab>("cassino");

  if (!showFura) {
    return <RelatoriosClient relatorios={cassino} nicho="cassino" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-6 border-b border-slate-800">
        {(
          [
            { id: "cassino" as const, label: "Cassino" },
            { id: "fura_fura" as const, label: "Fura Fura" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "pb-2.5 text-sm font-medium border-b-2 -mb-px transition",
              tab === t.id
                ? "border-primary-neon text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cassino" ? (
        <RelatoriosClient relatorios={cassino} nicho="cassino" />
      ) : (
        <FuraFuraRelatoriosLista coletas={furaColetas} />
      )}
    </div>
  );
}

function FuraFuraRelatoriosLista({ coletas }: { coletas: ColetaFuraRelatorio[] }) {
  if (coletas.length === 0) {
    return (
      <EmptyState
        title="Sem coletas fura-fura"
        description="Coletas com foto aparecem aqui. Faça uma nova coleta para registrar."
        actionLabel="Nova coleta"
        actionHref="/coletas/nova/fura-fura"
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
                className="w-full h-40 object-cover bg-slate-900"
              />
            ) : (
              <div className="w-full h-40 bg-slate-900 flex items-center justify-center text-slate-600">
                <FileImage className="h-10 w-10" />
              </div>
            )}
            <div className="p-4 space-y-2">
              <p className="font-medium text-white text-sm">{c.pontos?.nome ?? "Ponto"}</p>
              <p className="text-xs text-slate-400">{formatDateTime(c.created_at)}</p>
              <p className="text-xs text-green-400">
                Lucro {formatCurrency(lucro)} · {c.quantidade_furos ?? 0} furos
              </p>
              <div className="flex gap-2 pt-1 flex-wrap">
                {c.foto_url && (
                  <>
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
                  </>
                )}
                <Link
                  href={`/coletas/fura-fura/${c.id}`}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white ml-auto"
                >
                  Ver coleta
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
