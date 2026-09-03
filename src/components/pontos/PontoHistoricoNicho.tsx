"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { formatContador } from "@/lib/nichos/cassino";

type VisitaRow = {
  id: string;
  created_at: string;
  total_lucro_centavos: number | null;
  saldo_negativo: boolean | null;
};

type ColetaFuraRow = {
  id: string;
  created_at: string;
  valor_liquido: number | null;
  lucro_real: number | null;
};

type ColetaGenericaRow = {
  id: string;
  created_at: string;
  valor_liquido: number | null;
};

type Props =
  | { nicho: "maquinas_cassino"; visitas: VisitaRow[] | null }
  | { nicho: "ursinho"; coletas: ColetaFuraRow[] | null }
  | { nicho: "vending_ursinho" }
  | { nicho: "fura_fura"; coletas: ColetaFuraRow[] | null }
  | { nicho: "diversao"; coletas: ColetaFuraRow[] | null }
  | { nicho: "bolinha"; coletas: ColetaFuraRow[] | null }
  | { nicho: "consignado"; coletas: ColetaFuraRow[] | null }
  | { nicho: "outros"; coletas: ColetaGenericaRow[] | null };

function HistoricoRow({
  href,
  data,
  valor,
  hint = "Abrir · baixar, imprimir ou enviar",
  hoverClass = "hover:border-primary-neon/30 hover:bg-primary-neon/[0.04]",
}: {
  href: string;
  data: string;
  valor: ReactNode;
  hint?: string;
  hoverClass?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between gap-3 rounded-xl border border-at px-3 py-3 transition ${hoverClass}`}
    >
      <div className="min-w-0">
        <p className="text-sm text-at-primary/90">{data}</p>
        <p className="mt-0.5 text-[11px] text-at-muted group-hover:text-at-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-green-400">{valor}</span>
        <ChevronRight className="h-4 w-4 text-at-soft transition group-hover:text-primary-neon" />
      </div>
    </Link>
  );
}

function HistoricoCollapse({
  titulo,
  subtitulo,
  total,
  emptyLabel,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  total: number;
  emptyLabel: string;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02] sm:px-6"
      >
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{titulo}</h3>
          {subtitulo && aberto ? (
            <p className="mt-1 text-xs text-at-muted">{subtitulo}</p>
          ) : null}
          {!aberto && (
            <p className="mt-0.5 text-[12px] text-at-muted">
              {total === 0
                ? emptyLabel
                : `${total} ${total === 1 ? "registro" : "registros"} · toque para expandir`}
            </p>
          )}
        </div>
        {aberto ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-at-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-at-muted" />
        )}
      </button>

      {aberto && (
        <div className="space-y-2 border-t border-at px-5 pb-5 pt-4 sm:px-6">
          {total === 0 ? (
            <p className="text-sm text-at-muted">{emptyLabel}</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

export function PontoHistoricoNicho(props: Props) {
  if (props.nicho === "ursinho") {
    const coletas = props.coletas ?? [];
    return (
      <HistoricoCollapse
        titulo="Histórico de coletas"
        total={coletas.length}
        emptyLabel="Nenhuma coleta de ursinho registrada."
      >
        <div className="space-y-2">
          {coletas.map((c) => (
            <HistoricoRow
              key={c.id}
              href={`/coletas/ursinho/${c.id}`}
              data={formatDateTime(c.created_at)}
              valor={formatCurrency(Number(c.lucro_real ?? c.valor_liquido ?? 0))}
              hoverClass="hover:border-pink-500/30 hover:bg-pink-500/[0.04]"
            />
          ))}
        </div>
      </HistoricoCollapse>
    );
  }

  if (props.nicho === "diversao") {
    const coletas = props.coletas ?? [];
    return (
      <HistoricoCollapse
        titulo="Histórico de coletas"
        total={coletas.length}
        emptyLabel="Nenhuma coleta de diversão registrada."
      >
        <div className="space-y-2">
          {coletas.map((c) => (
            <HistoricoRow
              key={c.id}
              href={`/coletas/diversao/${c.id}`}
              data={formatDateTime(c.created_at)}
              valor={formatCurrency(Number(c.lucro_real ?? c.valor_liquido ?? 0))}
              hoverClass="hover:border-cyan-500/30 hover:bg-cyan-500/[0.04]"
            />
          ))}
        </div>
      </HistoricoCollapse>
    );
  }

  if (props.nicho === "bolinha") {
    const coletas = props.coletas ?? [];
    return (
      <HistoricoCollapse
        titulo="Histórico de coletas"
        total={coletas.length}
        emptyLabel="Nenhuma coleta de bolinha registrada."
      >
        <div className="space-y-2">
          {coletas.map((c) => (
            <HistoricoRow
              key={c.id}
              href={`/coletas/bolinha/${c.id}`}
              data={formatDateTime(c.created_at)}
              valor={formatCurrency(Number(c.lucro_real ?? c.valor_liquido ?? 0))}
              hoverClass="hover:border-orange-500/30 hover:bg-orange-500/[0.04]"
            />
          ))}
        </div>
      </HistoricoCollapse>
    );
  }

  if (props.nicho === "consignado") {
    const coletas = props.coletas ?? [];
    return (
      <HistoricoCollapse
        titulo="Histórico de recolhes"
        total={coletas.length}
        emptyLabel="Nenhum recolhe consignado registrado."
      >
        <div className="space-y-2">
          {coletas.map((c) => (
            <HistoricoRow
              key={c.id}
              href={`/coletas/consignado/${c.id}`}
              data={formatDateTime(c.created_at)}
              valor={formatCurrency(Number(c.lucro_real ?? c.valor_liquido ?? 0))}
              hoverClass="hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
            />
          ))}
        </div>
      </HistoricoCollapse>
    );
  }

  if (props.nicho === "vending_ursinho") {
    return (
      <HistoricoCollapse
        titulo="Histórico de leituras"
        total={0}
        emptyLabel="Nenhuma leitura de ursinho registrada ainda. O fluxo de coleta deste nicho será disponibilizado em breve."
      >
        {null}
      </HistoricoCollapse>
    );
  }

  if (props.nicho === "maquinas_cassino") {
    const visitas = props.visitas ?? [];
    return (
      <HistoricoCollapse
        titulo="Histórico de visitas"
        subtitulo="Toque numa visita para abrir o relatório — WhatsApp, baixar ou imprimir."
        total={visitas.length}
        emptyLabel="Nenhuma visita registrada."
      >
        <div className="space-y-2">
          {visitas.map((v) => (
            <HistoricoRow
              key={v.id}
              href={`/coletas/visita/${v.id}`}
              data={formatDateTime(v.created_at)}
              valor={
                v.saldo_negativo
                  ? "Negativo"
                  : formatContador(Number(v.total_lucro_centavos))
              }
            />
          ))}
        </div>
      </HistoricoCollapse>
    );
  }

  if (props.nicho === "fura_fura") {
    const coletas = props.coletas ?? [];
    return (
      <HistoricoCollapse
        titulo="Histórico de coletas"
        total={coletas.length}
        emptyLabel="Nenhuma coleta registrada."
      >
        <div className="space-y-2">
          {coletas.map((c) => (
            <HistoricoRow
              key={c.id}
              href={`/coletas/fura-fura/${c.id}`}
              data={formatDateTime(c.created_at)}
              valor={formatCurrency(Number(c.lucro_real ?? c.valor_liquido ?? 0))}
              hoverClass="hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
            />
          ))}
        </div>
      </HistoricoCollapse>
    );
  }

  const coletas = props.coletas ?? [];
  return (
    <HistoricoCollapse
      titulo="Histórico de coletas"
      total={coletas.length}
      emptyLabel="Nenhuma coleta registrada."
    >
      <div className="space-y-2">
        {coletas.map((c) => (
          <div
            key={c.id}
            className="flex justify-between border-b border-slate-800 py-2 last:border-0"
          >
            <span className="text-sm text-at-muted">{formatDate(c.created_at)}</span>
            <span className="text-sm font-medium text-green-400">
              {formatCurrency(Number(c.valor_liquido))}
            </span>
          </div>
        ))}
      </div>
    </HistoricoCollapse>
  );
}
