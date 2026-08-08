"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Circle,
  CircleDot,
  Gamepad2,
  LayoutGrid,
  Check,
  ChevronLeft,
  ChevronRight,
  Box,
  Plus,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  NICHO_CARD_VISUAL,
  nichosCardsParaExibir,
  nichoEstaContratado,
} from "@/lib/nicho";
import { getLockedNichoCta, getNichoPlanoStatus } from "@/lib/pricing";
import type { Equipamento, Nicho } from "@/lib/types/database";
import type { EstoqueBrindePonto } from "@/lib/estoque/brindes-ponto";
import type { ChamadoResumoEquipamento } from "@/lib/chamados/types";
import { EquipamentosSection } from "@/components/pontos/EquipamentosSection";
import {
  descNichoCatalog,
  labelNichoCatalog,
  useNichoCatalog,
} from "@/hooks/useNichoCovers";
import { cn } from "@/lib/utils";

const CARD_WIDTH = 240;
const CARD_GAP = 12;

const NICHO_ICONS: Record<Nicho, ReactNode> = {
  fura_fura: <CircleDot className="h-4 w-4" />,
  maquinas_cassino: <Building2 className="h-4 w-4" />,
  ursinho: <Box className="h-4 w-4" />,
  vending_ursinho: <Box className="h-4 w-4" />,
  diversao: <Gamepad2 className="h-4 w-4" />,
  bolinha: <Circle className="h-4 w-4" />,
  consignado: <Box className="h-4 w-4" />,
  outros: <LayoutGrid className="h-4 w-4" />,
};

export type PontoNichoPainelExtras = Partial<Record<Nicho, ReactNode>>;

export type PontoNichoEquipamentosCtx = {
  pontoId: string;
  equipamentos: Equipamento[];
  /** Equipamentos no estoque central (ponto_id null) disponíveis para alocar */
  estoqueDisponivel?: Equipamento[];
  outrosPontos?: { id: string; nome: string }[];
  nichosAtivos: Nicho[];
  chamadosAbertos?: ChamadoResumoEquipamento[];
  estoqueBrindesPonto?: EstoqueBrindePonto[];
  estoqueCentral?: {
    id: string;
    nome_item: string;
    custo_unitario: number;
    quantidade: number;
    foto_url?: string | null;
  }[];
};

type PontoNichoPainelProps = {
  nichosContratados: Nicho[];
  /** Faixa/plano atual — define limite de nichos */
  faixaPontos?: string | null;
  nichoInicial?: Nicho;
  /** CTA de coleta por nicho (acima de settings). */
  acoes?: PontoNichoPainelExtras;
  /** Configurações do nicho (acima dos equipamentos). */
  settings?: PontoNichoPainelExtras;
  /** Histórico / blocos abaixo dos equipamentos. */
  historicos?: PontoNichoPainelExtras;
  /** @deprecated prefer `settings` / `historicos` */
  cassino?: ReactNode;
  ursinho?: ReactNode;
  furaFura?: ReactNode;
  diversao?: ReactNode;
  bolinha?: ReactNode;
  outros?: ReactNode;
  /** Dados para sempre renderizar a lista/adição de equipamentos do nicho ativo */
  equipamentosCtx: PontoNichoEquipamentosCtx;
};

function NichoCardVertical({
  nicho,
  contratado,
  selected,
  onSelect,
  planoStatus,
  faixaPontos,
  coverImage,
  label,
  description,
}: {
  nicho: Nicho;
  contratado: boolean;
  selected: boolean;
  onSelect: () => void;
  planoStatus: ReturnType<typeof getNichoPlanoStatus>;
  faixaPontos?: string | null;
  coverImage: string;
  label: string;
  description: string;
}) {
  const visual = NICHO_CARD_VISUAL[nicho];
  const cta = !contratado ? getLockedNichoCta(nicho, planoStatus, faixaPontos) : null;
  const remote = coverImage.startsWith("http");

  const cardClass = cn(
    "relative flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border text-left transition-all",
    contratado
      ? cn(
          "cursor-pointer hover:brightness-105",
          selected
            ? cn("border-2", visual.accent.border, "ring-2", visual.accent.ring)
            : "border-slate-700/80 hover:border-slate-600"
        )
      : "border-slate-800/80 hover:border-primary-neon/30 hover:brightness-105"
  );

  const inner = (
    <>
      <div
        className={cn(
          "relative aspect-[4/3] w-full bg-slate-900",
          !contratado && "grayscale"
        )}
      >
        {remote ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={label}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            src={coverImage}
            alt={label}
            fill
            className="object-cover"
            sizes={`${CARD_WIDTH}px`}
          />
        )}
        {!contratado && <div className="absolute inset-0 bg-slate-950/55" />}

        <div className="absolute top-2 right-2">
          {selected ? (
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full shadow-md",
                visual.accent.checkBg
              )}
            >
              <Check className="h-3 w-3 text-white stroke-[3]" />
            </span>
          ) : contratado ? (
            <span className="block h-5 w-5 rounded-full border-2 border-slate-500 bg-slate-950/40 backdrop-blur-sm" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 bg-slate-950/70 backdrop-blur-sm">
              <Plus className="h-3 w-3 text-slate-400" />
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-[108px] flex-1 flex-col gap-1.5 p-3",
          !contratado && "grayscale-[0.35]"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-md p-1",
              contratado ? visual.accent.iconBg : "bg-slate-800",
              contratado ? visual.accent.iconText : "text-slate-500"
            )}
          >
            {NICHO_ICONS[nicho]}
          </span>
          <span
            className={cn(
              "text-sm font-semibold leading-tight",
              contratado ? "text-white" : "text-slate-400"
            )}
          >
            {label}
          </span>
        </div>
        <p
          className={cn(
            "line-clamp-3 flex-1 text-[11px] leading-snug",
            contratado ? "text-slate-400" : "text-slate-600"
          )}
        >
          {description}
        </p>
        {cta && (
          <div className="mt-auto space-y-0.5 pt-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium",
                cta.tone === "add" ? "text-primary-neon" : "text-amber-400"
              )}
            >
              {cta.tone === "add" ? (
                <Plus className="h-3 w-3 shrink-0" />
              ) : (
                <Sparkles className="h-3 w-3 shrink-0" />
              )}
              {cta.label}
              <ArrowRight className="h-3 w-3 shrink-0 opacity-70" />
            </span>
            <p className="text-[9px] leading-snug text-slate-600">{cta.hint}</p>
          </div>
        )}
      </div>
    </>
  );

  if (!contratado && cta) {
    return (
      <Link href={cta.href} style={{ width: CARD_WIDTH }} className={cardClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onSelect} style={{ width: CARD_WIDTH }} className={cardClass}>
      {inner}
    </button>
  );
}

export function PontoNichoPainel({
  nichosContratados,
  faixaPontos,
  nichoInicial,
  acoes,
  settings,
  historicos,
  cassino,
  ursinho,
  furaFura,
  diversao,
  bolinha,
  outros,
  equipamentosCtx,
}: PontoNichoPainelProps) {
  const catalog = useNichoCatalog();
  const cards = nichosCardsParaExibir().filter(
    (n) =>
      catalog.ativos.includes(n) || nichoEstaContratado(n, nichosContratados)
  );
  const planoStatus = getNichoPlanoStatus(nichosContratados, faixaPontos);
  const contratados = cards.filter((n) => nichoEstaContratado(n, nichosContratados));
  const bloqueados = cards.filter((n) => !nichoEstaContratado(n, nichosContratados));
  const nichoInicialValido =
    nichoInicial &&
    nichoEstaContratado(nichoInicial, nichosContratados) &&
    cards.includes(nichoInicial)
      ? nichoInicial
      : undefined;
  const [ativo, setAtivo] = useState<Nicho>(
    () => nichoInicialValido ?? contratados[0] ?? cards[0]
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /** Legacy: slots antigos carregavam settings+equipamentos+histórico juntos. */
  const legacyPorNicho: Partial<Record<Nicho, ReactNode>> = {
    maquinas_cassino: cassino,
    ursinho,
    vending_ursinho: ursinho,
    fura_fura: furaFura,
    diversao,
    bolinha,
    outros,
  };

  const nichoAtivo =
    nichoEstaContratado(ativo, nichosContratados) && cards.includes(ativo)
      ? ativo
      : contratados[0];

  const settingsAtivo = nichoAtivo ? (settings?.[nichoAtivo] ?? null) : null;
  const acaoAtiva = nichoAtivo ? (acoes?.[nichoAtivo] ?? null) : null;
  const historicoAtivo = nichoAtivo ? (historicos?.[nichoAtivo] ?? null) : null;
  const legacyAtivo = nichoAtivo ? (legacyPorNicho[nichoAtivo] ?? null) : null;
  const usaLayoutNovo = Boolean(settings || historicos);
  const mostraEstoqueBrindes =
    nichoAtivo === "ursinho" ||
    nichoAtivo === "vending_ursinho" ||
    nichoAtivo === "bolinha" ||
    nichoAtivo === "consignado";

  useEffect(() => {
    if (!nichoInicialValido) return;
    setAtivo(nichoInicialValido);
  }, [nichoInicialValido]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [updateScrollButtons, cards.length]);

  const scrollBy = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: direction * (CARD_WIDTH + CARD_GAP),
      behavior: "smooth",
    });
  };

  if (cards.length === 0) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Nichos
        </h2>
        <p className="mt-1 text-[15px] text-white">Escolha o tipo de máquina neste ponto</p>
      </div>

      {bloqueados.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm">
          <p className="text-slate-300">
            {planoStatus.podeAdicionarNicho ? (
              <>
                Seu plano permite até{" "}
                <span className="font-medium text-white">{planoStatus.maxNichosPagos} nichos</span>.
                Você usa{" "}
                <span className="font-medium text-white">{planoStatus.nichosPagosAtivos}</span>
                {planoStatus.vagasRestantes > 0 && (
                  <>
                    {" "}
                    — ainda pode adicionar{" "}
                    <span className="font-medium text-primary-neon">
                      {planoStatus.vagasRestantes}
                    </span>
                    .
                  </>
                )}
              </>
            ) : (
              <>
                Você já usa os{" "}
                <span className="font-medium text-white">{planoStatus.maxNichosPagos} nichos</span>{" "}
                do plano. Para trocar ou ajustar, vá em Planos.
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Nichos são ativados em{" "}
            <Link href="/planos" className="text-primary-neon hover:underline">
              Planos e assinatura
            </Link>
            {planoStatus.podeAdicionarNicho
              ? " — clique em um card bloqueado ou no link acima para adicionar."
              : " — desmarque um nicho e marque outro, depois salve."}
          </p>
        </div>
      )}

      <div className="relative group/carousel">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="absolute left-0 top-[calc(50%-12px)] z-10 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900/95 p-1.5 text-slate-300 shadow-lg hover:bg-slate-800 hover:text-white transition"
            aria-label="Nichos anteriores"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="absolute right-0 top-[calc(50%-12px)] z-10 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900/95 p-1.5 text-slate-300 shadow-lg hover:bg-slate-800 hover:text-white transition"
            aria-label="Próximos nichos"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className={cn(
            "flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory",
            "scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
          style={{ scrollPaddingLeft: 4 }}
        >
          {cards.map((nicho) => (
            <NichoCardVertical
              key={nicho}
              nicho={nicho}
              contratado={nichoEstaContratado(nicho, nichosContratados)}
              selected={nichoEstaContratado(nicho, nichosContratados) && nicho === nichoAtivo}
              onSelect={() => setAtivo(nicho)}
              planoStatus={planoStatus}
              faixaPontos={faixaPontos}
              coverImage={catalog.covers[nicho] ?? NICHO_CARD_VISUAL[nicho].coverImage}
              label={labelNichoCatalog(catalog, nicho)}
              description={descNichoCatalog(catalog, nicho)}
            />
          ))}
        </div>

        <div className="flex justify-center gap-1.5 mt-3">
          {cards.map((nicho) => {
            const contratado = nichoEstaContratado(nicho, nichosContratados);
            const selected = contratado && nicho === nichoAtivo;
            const visual = NICHO_CARD_VISUAL[nicho];
            return (
              <button
                key={nicho}
                type="button"
                onClick={() => {
                  if (contratado) setAtivo(nicho);
                  const idx = cards.indexOf(nicho);
                  scrollRef.current?.scrollTo({
                    left: idx * (CARD_WIDTH + CARD_GAP),
                    behavior: "smooth",
                  });
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  selected
                    ? cn("w-6", visual.accent.checkBg)
                    : contratado
                      ? "w-1.5 bg-slate-600 hover:bg-slate-500"
                      : "w-1.5 bg-slate-800 hover:bg-slate-700"
                )}
                aria-label={labelNichoCatalog(catalog, nicho)}
              />
            );
          })}
        </div>
      </div>

      {nichoAtivo && (
        <div className="space-y-6 pt-1">
          {usaLayoutNovo ? (
            <>
              {acaoAtiva}
              {settingsAtivo}
              <EquipamentosSection
                pontoId={equipamentosCtx.pontoId}
                equipamentos={equipamentosCtx.equipamentos}
                estoqueDisponivel={equipamentosCtx.estoqueDisponivel}
                outrosPontos={equipamentosCtx.outrosPontos}
                nichosAtivos={equipamentosCtx.nichosAtivos}
                nichoFiltro={nichoAtivo}
                chamadosAbertos={equipamentosCtx.chamadosAbertos}
                estoqueBrindesPonto={
                  mostraEstoqueBrindes ? equipamentosCtx.estoqueBrindesPonto : undefined
                }
                estoqueCentral={
                  mostraEstoqueBrindes ? equipamentosCtx.estoqueCentral : undefined
                }
              />
              {historicoAtivo}
            </>
          ) : (
            legacyAtivo
          )}
        </div>
      )}
    </div>
  );
}
