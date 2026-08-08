"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Gamepad2,
  LayoutGrid,
  Box,
  Plus,
  Sparkles,
  ArrowRight,
  Lock,
} from "lucide-react";
import { NICHO_CARD_VISUAL, nichosCardsParaExibir } from "@/lib/nicho";
import {
  descNichoCatalog,
  labelNichoCatalog,
  useNichoCatalog,
} from "@/hooks/useNichoCovers";
import { mensagemConfirmarNicho } from "@/lib/nichos/nicho-travado";
import type { Nicho } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export const NICHO_CAROUSEL_CARD_WIDTH = 240;
export const NICHO_CAROUSEL_CARD_GAP = 12;

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

export type NichoCarouselLockedCta = {
  href: string;
  label: string;
  hint: string;
  tone: "add" | "upgrade";
};

type CardProps = {
  nicho: Nicho;
  selected: boolean;
  /** false = card bloqueado (grayscale + CTA). No onboarding, sempre true. */
  disponivel?: boolean;
  /** Já confirmado — não dá para desmarcar. */
  travado?: boolean;
  coverImage: string;
  label: string;
  description: string;
  onSelect: () => void;
  lockedCta?: NichoCarouselLockedCta | null;
};

export function NichoCarouselCard({
  nicho,
  selected,
  disponivel = true,
  travado = false,
  coverImage,
  label,
  description,
  onSelect,
  lockedCta = null,
}: CardProps) {
  const visual = NICHO_CARD_VISUAL[nicho];
  const remote = coverImage.startsWith("http");
  const locked = !disponivel;

  const cardClass = cn(
    "relative flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border text-left transition-all",
    locked
      ? "border-slate-800/80 hover:border-primary-neon/30 hover:brightness-105"
      : cn(
          "cursor-pointer hover:brightness-105",
          selected
            ? cn("border-2", visual.accent.border, "ring-2", visual.accent.ring)
            : "border-slate-700/80 hover:border-slate-600"
        )
  );

  const inner = (
    <>
      <div
        className={cn(
          "relative aspect-[4/3] w-full bg-slate-900",
          locked && "grayscale"
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
            sizes={`${NICHO_CAROUSEL_CARD_WIDTH}px`}
          />
        )}
        {locked && <div className="absolute inset-0 bg-slate-950/55" />}

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {travado && selected && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/80 text-amber-300 shadow-md ring-1 ring-amber-400/40">
              <Lock className="h-3 w-3" />
            </span>
          )}
          {selected ? (
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full shadow-md",
                visual.accent.checkBg
              )}
            >
              <Check className="h-3 w-3 text-white stroke-[3]" />
            </span>
          ) : disponivel ? (
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
          locked && "grayscale-[0.35]"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-md p-1",
              disponivel ? visual.accent.iconBg : "bg-slate-800",
              disponivel ? visual.accent.iconText : "text-slate-500"
            )}
          >
            {NICHO_ICONS[nicho]}
          </span>
          <span
            className={cn(
              "text-sm font-semibold leading-tight",
              disponivel ? "text-white" : "text-slate-400"
            )}
          >
            {label}
          </span>
        </div>
        <p
          className={cn(
            "line-clamp-3 flex-1 text-[11px] leading-snug",
            disponivel ? "text-slate-400" : "text-slate-600"
          )}
        >
          {description}
        </p>
        {lockedCta && (
          <div className="mt-auto space-y-0.5 pt-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium",
                lockedCta.tone === "add" ? "text-primary-neon" : "text-amber-400"
              )}
            >
              {lockedCta.tone === "add" ? (
                <Plus className="h-3 w-3 shrink-0" />
              ) : (
                <Sparkles className="h-3 w-3 shrink-0" />
              )}
              {lockedCta.label}
              <ArrowRight className="h-3 w-3 shrink-0 opacity-70" />
            </span>
            <p className="text-[9px] leading-snug text-slate-600">{lockedCta.hint}</p>
          </div>
        )}
      </div>
    </>
  );

  if (locked && lockedCta) {
    return (
      <Link
        href={lockedCta.href}
        style={{ width: NICHO_CAROUSEL_CARD_WIDTH }}
        className={cardClass}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ width: NICHO_CAROUSEL_CARD_WIDTH }}
      className={cardClass}
    >
      {inner}
    </button>
  );
}

type CarouselProps = {
  /** Seleção única (ponto / config). Ignorado se `values` for passado. */
  value?: Nicho | "";
  onChange?: (nicho: Nicho) => void;
  /** Seleção múltipla (pesquisa). */
  values?: Nicho[];
  onChangeMulti?: (nichos: Nicho[]) => void;
  /** Se omitido, mostra todos os cards do catálogo (não pausados). */
  cards?: Nicho[];
  /** Quais estão liberados no contexto (ex.: contratados). Pausados do dono nunca entram. */
  disponiveis?: Nicho[];
  getLockedCta?: (nicho: Nicho) => NichoCarouselLockedCta | null;
  /**
   * Nichos já salvos/confirmados — não dá para desmarcar.
   * Novos selecionados com `confirmBeforeSelect` também ficam travados na sessão.
   */
  lockedValues?: Nicho[];
  /** Pede confirmação antes de marcar um nicho novo (e trava após confirmar). */
  confirmBeforeSelect?: boolean;
  /** Callback quando o usuário tenta desmarcar um nicho travado. */
  onLockedAttempt?: (nicho: Nicho) => void;
  title?: string;
  subtitle?: string;
  className?: string;
  showDots?: boolean;
};

/** Carrossel de nichos com foto — o mesmo usado na página do ponto. */
export function NichoCardsCarousel({
  value = "",
  onChange,
  values,
  onChangeMulti,
  cards: cardsProp,
  disponiveis,
  getLockedCta,
  lockedValues = [],
  confirmBeforeSelect = false,
  onLockedAttempt,
  title = "Nichos",
  subtitle = "Escolha o tipo de máquina da sua operação",
  className,
  showDots = true,
}: CarouselProps) {
  const multi = Array.isArray(values) && typeof onChangeMulti === "function";
  const catalog = useNichoCatalog();
  const [confirmadosSessao, setConfirmadosSessao] = useState<Nicho[]>([]);
  const lockedKey = useMemo(
    () => [...lockedValues].sort().join("|"),
    [lockedValues]
  );
  const travados = useMemo(
    () => new Set<Nicho>([...lockedValues, ...confirmadosSessao]),
    [lockedValues, confirmadosSessao]
  );

  useEffect(() => {
    setConfirmadosSessao([]);
  }, [lockedKey]);

  const base = cardsProp ?? nichosCardsParaExibir();
  const selecionados = new Set<Nicho>(
    multi ? (values ?? []) : value ? [value as Nicho] : []
  );
  // Pausados do dono nunca entram no carrossel (exceto se já estiverem selecionados).
  const lista = base.filter((n) => {
    if (selecionados.has(n)) return true;
    if (!catalog.ready) return false;
    if (catalog.pausados.includes(n)) return false;
    if (disponiveis && !disponiveis.includes(n)) return false;
    if (catalog.ativos.length === 0) return true;
    return catalog.ativos.includes(n);
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
  }, [updateScrollButtons, lista.length]);

  const scrollBy = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: direction * (NICHO_CAROUSEL_CARD_WIDTH + NICHO_CAROUSEL_CARD_GAP),
      behavior: "smooth",
    });
  };

  const isDisponivel = (n: Nicho) =>
    disponiveis ? disponiveis.includes(n) : true;

  function toggleMulti(nicho: Nicho) {
    if (!multi || !onChangeMulti) return;
    const set = new Set(values);
    if (set.has(nicho)) {
      if (travados.has(nicho)) {
        onLockedAttempt?.(nicho);
        return;
      }
      set.delete(nicho);
      onChangeMulti([...set]);
      return;
    }
    if (confirmBeforeSelect) {
      const ok = window.confirm(mensagemConfirmarNicho(nicho));
      if (!ok) return;
      setConfirmadosSessao((prev) =>
        prev.includes(nicho) ? prev : [...prev, nicho]
      );
    }
    set.add(nicho);
    onChangeMulti([...set]);
  }

  if (lista.length === 0) return null;

  return (
    <div className={cn("space-y-5", className)}>
      {(title || subtitle) && (
        <div>
          {title && (
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-[15px] text-white">{subtitle}</p>
          )}
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
          {lista.map((nicho) => {
            const disponivel = isDisponivel(nicho);
            const selected = multi
              ? disponivel && values!.includes(nicho)
              : disponivel && value === nicho;
            const travado = travados.has(nicho);
            return (
              <NichoCarouselCard
                key={nicho}
                nicho={nicho}
                selected={selected}
                disponivel={disponivel}
                travado={travado}
                coverImage={
                  catalog.covers[nicho] ?? NICHO_CARD_VISUAL[nicho].coverImage
                }
                label={labelNichoCatalog(catalog, nicho)}
                description={descNichoCatalog(catalog, nicho)}
                onSelect={() => {
                  if (!disponivel) return;
                  if (multi) {
                    toggleMulti(nicho);
                    return;
                  }
                  if (confirmBeforeSelect && value !== nicho) {
                    const ok = window.confirm(mensagemConfirmarNicho(nicho));
                    if (!ok) return;
                    setConfirmadosSessao((prev) =>
                      prev.includes(nicho) ? prev : [...prev, nicho]
                    );
                  }
                  onChange?.(nicho);
                }}
                lockedCta={
                  !disponivel && getLockedCta ? getLockedCta(nicho) : null
                }
              />
            );
          })}
        </div>

        {showDots && (
          <div className="mt-3 flex justify-center gap-1.5">
            {lista.map((nicho) => {
              const disponivel = isDisponivel(nicho);
              const selected = multi
                ? disponivel && values!.includes(nicho)
                : disponivel && value === nicho;
              const visual = NICHO_CARD_VISUAL[nicho];
              return (
                <button
                  key={nicho}
                  type="button"
                  onClick={() => {
                    if (disponivel) {
                      if (multi) {
                        toggleMulti(nicho);
                      } else {
                        if (confirmBeforeSelect && value !== nicho) {
                          const ok = window.confirm(mensagemConfirmarNicho(nicho));
                          if (!ok) return;
                          setConfirmadosSessao((prev) =>
                            prev.includes(nicho) ? prev : [...prev, nicho]
                          );
                        }
                        onChange?.(nicho);
                      }
                    }
                    const idx = lista.indexOf(nicho);
                    scrollRef.current?.scrollTo({
                      left:
                        idx *
                        (NICHO_CAROUSEL_CARD_WIDTH + NICHO_CAROUSEL_CARD_GAP),
                      behavior: "smooth",
                    });
                  }}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    selected
                      ? cn("w-6", visual.accent.checkBg)
                      : disponivel
                        ? "w-1.5 bg-slate-600 hover:bg-slate-500"
                        : "w-1.5 bg-slate-800 hover:bg-slate-700"
                  )}
                  aria-label={labelNichoCatalog(catalog, nicho)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
