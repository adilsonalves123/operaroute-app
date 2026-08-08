"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, History, Loader2 } from "lucide-react";
import { ExpandableImage } from "@/components/ui/ExpandableImage";
import type { BuscaNumeroSerieResult } from "@/lib/equipamentos/numero-serie";
import { formatContador, centesimosToReais } from "@/lib/nichos/cassino";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface HistoricoNumeroSerieProps {
  serie: string;
  pontoId?: string;
  compacto?: boolean;
  onAplicarSugestao?: (dados: {
    nome: string;
    numero_entrada: string;
    numero_saida: string;
    foto_url: string | null;
  }) => void;
}

export function HistoricoNumeroSerie({
  serie,
  pontoId,
  compacto = false,
  onAplicarSugestao,
}: HistoricoNumeroSerieProps) {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<BuscaNumeroSerieResult | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const termo = serie.trim();
    if (termo.length < 2) {
      setDados(null);
      setErro("");
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setErro("");
      try {
        const params = new URLSearchParams({ serie: termo });
        if (pontoId) params.set("ponto_id", pontoId);
        const res = await fetch(`/api/equipamentos/buscar?${params}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) {
          setDados(null);
          setErro(json.error ?? "Erro ao buscar histórico.");
          return;
        }
        setDados(json as BuscaNumeroSerieResult);
      } catch {
        setDados(null);
        setErro("Erro de conexão ao buscar histórico.");
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [serie, pontoId]);

  if (serie.trim().length < 2) return null;

  const ultimoEquipamento =
    dados?.equipamento_ativo ?? dados?.equipamentos_historico[0] ?? null;
  const ultimaColeta = dados?.coletas[0] ?? null;

  function aplicarSugestao() {
    if (!onAplicarSugestao || !ultimoEquipamento) return;
    const entrada =
      ultimoEquipamento.numero_entrada != null
        ? formatContador(Math.round(Number(ultimoEquipamento.numero_entrada)))
        : ultimaColeta?.entrada_atual != null
          ? formatContador(Math.round(Number(ultimaColeta.entrada_atual)))
          : "";
    const saida =
      ultimoEquipamento.numero_saida != null
        ? formatContador(Math.round(Number(ultimoEquipamento.numero_saida)))
        : ultimaColeta?.saida_atual != null
          ? formatContador(Math.round(Number(ultimaColeta.saida_atual)))
          : "";

    onAplicarSugestao({
      nome: ultimoEquipamento.nome,
      numero_entrada: entrada,
      numero_saida: saida,
      foto_url: dados?.foto_referencia ?? null,
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-cyan-500/25 bg-cyan-500/5 space-y-3",
        compacto ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-center gap-2 text-cyan-300">
        <History className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium">Histórico da série</p>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400/80" />}
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {!loading && dados && !dados.encontrado && (
        <p className="text-xs text-slate-400">
          Nenhum registro anterior para esta série — máquina nova no sistema.
        </p>
      )}

      {dados?.aviso && (
        <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{dados.aviso}</span>
        </div>
      )}

      {dados?.encontrado && (
        <>
          {dados.foto_referencia && (
            <div className="flex items-start gap-3">
              <ExpandableImage
                src={dados.foto_referencia}
                alt="Foto da máquina"
                className="h-16 w-16 rounded-lg object-cover border border-slate-700"
              />
              <div className="text-xs text-slate-400 space-y-1">
                <p>Foto de referência da máquina</p>
                {ultimoEquipamento?.ponto_nome && (
                  <p>
                    Último ponto: <span className="text-slate-300">{ultimoEquipamento.ponto_nome}</span>
                  </p>
                )}
                {dados.coletas.length > 0 && (
                  <p>{dados.coletas.length} leitura(s) no histórico</p>
                )}
              </div>
            </div>
          )}

          {onAplicarSugestao && ultimoEquipamento && (
            <button
              type="button"
              onClick={aplicarSugestao}
              className="text-xs font-medium text-primary-neon hover:underline"
            >
              Usar nome e últimas leituras do histórico
            </button>
          )}

          {dados.coletas.length > 0 && (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {dados.coletas.slice(0, compacto ? 3 : 8).map((c) => (
                <div
                  key={c.id}
                  className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">{formatDate(c.created_at)}</span>
                    {c.ponto_nome && (
                      <span className="text-slate-500 truncate">{c.ponto_nome}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                    <span className="text-green-400/90">
                      Ent: {formatContador(Number(c.entrada_periodo ?? 0))}
                    </span>
                    <span className="text-red-400/90">
                      Saí: {formatContador(Number(c.saida_periodo ?? 0))}
                    </span>
                    {c.lucro_centavos != null && (
                      <span className="text-slate-300">
                        Lucro: {formatCurrency(centesimosToReais(c.lucro_centavos))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {c.foto_url ? (
                      <ExpandableImage
                        src={c.foto_url}
                        alt="Foto da coleta"
                        className="h-10 w-10 rounded object-cover border border-slate-700"
                      />
                    ) : (
                      <span className="text-slate-600">Sem foto na coleta</span>
                    )}
                    {c.visita_id && (
                      <Link
                        href={`/coletas/visita/${c.visita_id}`}
                        className="text-primary-neon hover:underline shrink-0"
                      >
                        Ver visita
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
