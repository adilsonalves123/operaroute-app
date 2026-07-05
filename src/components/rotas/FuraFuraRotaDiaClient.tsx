"use client";

import Link from "next/link";
import { Navigation, Package } from "lucide-react";
import { PontoFuraAlertas } from "@/components/coletas/fura-fura/PontoFuraAlertas";
import {
  alertasPontoFura,
  diasDesdeColeta,
  linksNavegacaoPonto,
  prioridadeRotaPonto,
} from "@/lib/nichos/fura-fura";
import type { Ponto } from "@/lib/types/database";
import { formatDate } from "@/lib/utils";

type PontoRota = Ponto;

export function FuraFuraRotaDiaClient({ pontos }: { pontos: PontoRota[] }) {
  const ordenados = [...pontos].sort(
    (a, b) => prioridadeRotaPonto(a) - prioridadeRotaPonto(b)
  );

  if (ordenados.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-sm text-slate-500">
        Nenhum ponto ativo para visitar hoje.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ordenados.map((ponto, index) => {
        const nav = linksNavegacaoPonto(ponto);
        const dias = diasDesdeColeta(ponto.ultima_coleta);
        const temAlerta = alertasPontoFura(ponto).length > 0;

        return (
          <div
            key={ponto.id}
            className={`glass-card p-4 space-y-3 ${temAlerta ? "border-amber-500/20" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
                  <p className="font-medium text-white truncate">{ponto.nome}</p>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {[ponto.endereco, ponto.bairro, ponto.cidade].filter(Boolean).join(", ") ||
                    "Sem endereço"}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {ponto.ultima_coleta
                    ? `Última coleta: ${formatDate(ponto.ultima_coleta)}`
                    : "Nunca coletou"}
                  {dias != null && dias > 0 && ` · há ${dias} dias`}
                  {ponto.furos_estoque != null && ` · ${ponto.furos_estoque} furos`}
                </p>
              </div>
              <Link
                href={`/coletas/nova/fura-fura?ponto=${ponto.id}`}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary-neon px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-cyan-300"
              >
                <Package className="h-3.5 w-3.5" />
                Coletar
              </Link>
            </div>

            <PontoFuraAlertas ponto={ponto} />

            {nav && (
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={nav.waze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-primary-neon/40"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Waze
                </a>
                <a
                  href={nav.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-primary-neon/40"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Maps
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
