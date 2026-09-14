"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EquipamentoEditarButton } from "@/components/pontos/EquipamentoEditarButton";
import { EquipamentoTransferirButton } from "@/components/pontos/EquipamentoTransferirButton";
import { EquipamentoExcluirButton } from "@/components/pontos/EquipamentoExcluirButton";
import { EquipamentoFotoThumb } from "@/components/pontos/EquipamentoFotoThumb";
import { AbrirChamadoButton } from "@/components/chamados/AbrirChamadoButton";
import { EquipamentoDetalheModal } from "@/components/equipamentos/EquipamentoDetalheModal";
import {
  getEquipamentoDisplayNome,
  getEquipamentoTipoLabel,
  groupEquipamentosPorModulo,
  equipamentoCombinaBusca,
  cassinoSemNumeroSerie,
  isEquipamentoTipoDiversao,
  type EquipamentoGrupoId,
} from "@/lib/equipamentos";
import type { ChamadoResumoEquipamento } from "@/lib/chamados/types";
import { formatContador } from "@/lib/nichos/cassino";
import type { Equipamento } from "@/lib/types/database";
import type { EstoqueBrindePonto } from "@/lib/estoque/brindes-ponto";
import { ExternalLink, MapPin, Package, Search } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { normalizarEstoqueBrindesPonto } from "@/lib/estoque/brindes-ponto";
import { somarEstoqueBrindes } from "@/lib/estoque/transferir-maquina";

function EquipamentoCard({
  eq,
  pontoId,
  pontoNome,
  showPonto,
  outrosPontos,
  grupoId,
  showSubtipo,
  chamadoAberto,
  estoqueBrindesPonto = [],
  estoqueCentral = [],
}: {
  eq: Equipamento;
  pontoId: string;
  pontoNome?: string | null;
  showPonto?: boolean;
  outrosPontos?: { id: string; nome: string }[];
  grupoId: EquipamentoGrupoId;
  showSubtipo: boolean;
  chamadoAberto?: ChamadoResumoEquipamento | null;
  estoqueBrindesPonto?: EstoqueBrindePonto[];
  estoqueCentral?: { id: string; nome_item: string; custo_unitario: number; quantidade: number; foto_url?: string | null }[];
}) {
  void grupoId;
  const displayNome = getEquipamentoDisplayNome(eq);
  const seriePendente = cassinoSemNumeroSerie(eq);
  const [open, setOpen] = useState(false);
  const isUrso =
    eq.tipo === "ursinho" || eq.tipo === "vending_ursinho" || eq.tipo === "bolinha";
  const isConsignado = eq.tipo === "consignado";
  const brindesMaquina =
    isUrso || isConsignado ? normalizarEstoqueBrindesPonto(eq.estoque_brindes) : [];
  const totalBrindesMaquina = somarEstoqueBrindes(brindesMaquina);

  const metaBits: string[] = [];
  if (showSubtipo) metaBits.push(getEquipamentoTipoLabel(eq.tipo));
  if (
    (eq.tipo === "cassino" ||
      eq.tipo === "ursinho" ||
      eq.tipo === "bolinha" ||
      isEquipamentoTipoDiversao(eq.tipo)) &&
    eq.numero_serie
  ) {
    metaBits.push(`Painel ${eq.numero_serie}`);
  }
  if (eq.tipo === "cassino") {
    metaBits.push(
      `E ${eq.numero_entrada != null ? formatContador(Math.round(Number(eq.numero_entrada))) : "—"}`
    );
    metaBits.push(
      `S ${eq.numero_saida != null ? formatContador(Math.round(Number(eq.numero_saida))) : "—"}`
    );
  }
  if (eq.tipo === "bolinha") {
    metaBits.push(
      eq.preco_jogada != null && Number(eq.preco_jogada) > 0
        ? formatCurrency(Number(eq.preco_jogada))
        : "Jogada —"
    );
    metaBits.push(
      totalBrindesMaquina > 0 ? `${totalBrindesMaquina} cáps.` : "Sem cápsulas"
    );
  }
  if (eq.tipo === "ursinho" || eq.tipo === "vending_ursinho") {
    metaBits.push(
      eq.entrada_atual != null
        ? `Visor ${formatContador(Math.round(Number(eq.entrada_atual)))}`
        : "Visor —"
    );
    metaBits.push(
      totalBrindesMaquina > 0 ? `${totalBrindesMaquina} brindes` : "Sem brindes"
    );
  }
  if (isConsignado) {
    metaBits.push(
      totalBrindesMaquina > 0 ? `${totalBrindesMaquina} un.` : "Expositor vazio"
    );
  }
  if (isEquipamentoTipoDiversao(eq.tipo)) {
    metaBits.push(
      eq.entrada_atual != null
        ? `Visor ${formatContador(Math.round(Number(eq.entrada_atual)))}`
        : "Visor —"
    );
  }
  if (eq.tipo === "fura_fura") {
    metaBits.push("Coleta por furos");
  }

  return (
    <>
      <div
        className={cn(
          "group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3.5 transition hover:bg-at-card-soft",
          seriePendente && "border-l-2 border-l-rose-400/45 pl-3 -ml-0.5"
        )}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <EquipamentoFotoThumb equipamento={eq} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <p className="truncate text-[14px] font-medium tracking-tight text-at-primary group-hover:text-at-link">
              {displayNome}
            </p>
            {seriePendente && (
              <span className="text-[10px] uppercase tracking-[0.14em] text-rose-300/80">
                Série pendente
              </span>
            )}
            {chamadoAberto && (
              <span className="text-[10px] uppercase tracking-[0.14em] text-amber-200/75">
                Manutenção
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-at-muted">
            {showPonto && eq.ponto_id && pontoNome && (
              <Link
                href={`/pontos/${pontoId}`}
                className="inline-flex max-w-[12rem] items-center gap-1 truncate text-at-soft transition hover:text-at-link"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="h-3 w-3 shrink-0 opacity-60" />
                <span className="truncate">{pontoNome}</span>
              </Link>
            )}
            {showPonto && eq.ponto_id && !pontoNome && (
              <span className="inline-flex items-center gap-1 text-amber-300/90">
                <MapPin className="h-3 w-3 shrink-0 opacity-60" />
                Ponto removido — devolva ao estoque
              </span>
            )}
            {showPonto && !eq.ponto_id && (
              <span className="inline-flex items-center gap-1 text-at-muted">
                <Package className="h-3 w-3 shrink-0 opacity-60" />
                Estoque
              </span>
            )}
            {chamadoAberto && (
              <a
                href="/chamados"
                className="truncate text-at-muted hover:text-amber-600 dark:hover:text-amber-200/90"
                onClick={(e) => e.stopPropagation()}
                title={chamadoAberto.titulo}
              >
                · {chamadoAberto.titulo}
              </a>
            )}
          </div>

          {metaBits.length > 0 && (
            <p className="mt-1.5 truncate font-mono text-[11px] tabular-nums tracking-wide text-at-soft">
              {metaBits.join("  ·  ")}
            </p>
          )}

          {eq.observacao && (
            <p className="mt-1 truncate text-[11px] text-at-soft">{eq.observacao}</p>
          )}
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5 opacity-70 transition group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <EquipamentoEditarButton equipamento={eq} />
          {eq.ponto_id && (
            <AbrirChamadoButton
              pontoId={pontoId}
              equipamentoId={eq.id}
              equipamentoNome={displayNome}
              variant="icon"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-at-muted transition hover:bg-at-card-soft hover:text-at-link"
            />
          )}
          {eq.ponto_id && (
            <EquipamentoTransferirButton
              equipamento={eq}
              pontoAtualId={pontoId}
              outrosPontos={outrosPontos}
            />
          )}
          <EquipamentoExcluirButton equipamento={eq} />
          <ExternalLink className="ml-1 hidden h-3.5 w-3.5 text-at-soft sm:block" />
        </div>
      </div>

      <EquipamentoDetalheModal
        open={open}
        onClose={() => setOpen(false)}
        equipamento={eq}
        pontoNome={pontoNome}
        estoqueBrindesPonto={estoqueBrindesPonto}
        estoqueCentral={estoqueCentral}
      />
    </>
  );
}

export function EquipamentosList({
  equipamentos,
  pontoId,
  showPonto = false,
  pontosPorId,
  todosPontos,
  outrosPontos,
  chamadosAbertos = [],
  emptyMessage,
  hideSearch = false,
  estoqueBrindesPonto = [],
  estoqueCentral = [],
}: {
  equipamentos: Equipamento[];
  pontoId?: string;
  showPonto?: boolean;
  pontosPorId?: Map<string, { id: string; nome: string }>;
  todosPontos?: { id: string; nome: string }[];
  outrosPontos?: { id: string; nome: string }[];
  chamadosAbertos?: ChamadoResumoEquipamento[];
  emptyMessage?: string;
  hideSearch?: boolean;
  estoqueBrindesPonto?: EstoqueBrindePonto[];
  estoqueCentral?: { id: string; nome_item: string; custo_unitario: number; quantidade: number; foto_url?: string | null }[];
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(
    () => equipamentos.filter((eq) => equipamentoCombinaBusca(eq, busca)),
    [equipamentos, busca]
  );

  if (!equipamentos.length) {
    return (
      <p className="text-sm text-at-muted">
        {emptyMessage ?? "Nenhum equipamento cadastrado neste ponto."}
      </p>
    );
  }

  const grupos = groupEquipamentosPorModulo(filtrados);
  const multiModulo = grupos.length > 1;

  return (
    <div className={cn("space-y-6", multiModulo && "space-y-10")}>
      {!hideSearch && (
        <div className="flex items-center gap-2.5 border-b border-at pb-3 focus-within:border-[var(--at-tab-active-border)]">
          <Search className="h-3.5 w-3.5 shrink-0 text-at-muted" aria-hidden />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Série, número ou nome…"
            className="min-w-0 flex-1 !border-0 !bg-transparent !p-0 !shadow-none text-[13px] tracking-wide text-at-primary placeholder:text-at-soft focus:!border-transparent focus:!shadow-none focus:!ring-0"
            aria-label="Buscar máquinas"
          />
        </div>
      )}

      {filtrados.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-at-muted">
          Nenhuma máquina neste filtro.
        </p>
      ) : (
        <div className={cn("space-y-8", multiModulo && "space-y-12")}>
          {grupos.map(({ grupo, items }) => {
            const showSubtipo = new Set(items.map((i) => i.tipo)).size > 1;

            return (
              <section key={grupo.id}>
                <header className="mb-1 flex items-end justify-between gap-4 border-b border-at pb-3">
                  <div className="min-w-0">
                    <h3
                      className="text-[1.35rem] font-normal leading-none tracking-tight text-at-primary"
                      style={{
                        fontFamily:
                          "var(--font-eq-display), var(--font-pontos-display), Georgia, serif",
                      }}
                    >
                      {grupo.label}
                    </h3>
                    <p className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-at-muted">
                      {grupo.subtitle}
                    </p>
                  </div>
                  <p className="shrink-0 pb-0.5 font-mono text-[11px] tabular-nums text-at-muted">
                    {items.length}
                    <span className="ml-1.5 font-sans normal-case tracking-normal text-at-soft">
                      {items.length === 1 ? "máquina" : "máquinas"}
                    </span>
                  </p>
                </header>

                <div className="divide-y divide-[var(--at-border-soft)]">
                  {items.map((eq) => {
                    const eqPontoId = pontoId ?? eq.ponto_id ?? "";
                    const pontoInfo = eq.ponto_id
                      ? pontosPorId?.get(eq.ponto_id)
                      : undefined;
                    const transferPontos =
                      outrosPontos ?? todosPontos?.filter((p) => p.id !== eq.ponto_id);

                    return (
                      <EquipamentoCard
                        key={eq.id}
                        eq={eq}
                        pontoId={eqPontoId}
                        pontoNome={pontoInfo?.nome}
                        showPonto={showPonto}
                        outrosPontos={transferPontos}
                        grupoId={grupo.id}
                        showSubtipo={showSubtipo}
                        chamadoAberto={
                          chamadosAbertos.find((c) => c.equipamento_id === eq.id) ??
                          null
                        }
                        estoqueBrindesPonto={estoqueBrindesPonto}
                        estoqueCentral={estoqueCentral}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
