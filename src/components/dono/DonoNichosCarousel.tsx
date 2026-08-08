"use client";

import Image from "next/image";
import Link from "next/link";
import { NICHO_CARD_VISUAL, NICHO_CARDS_EXIBICAO } from "@/lib/nicho";
import {
  descNichoCatalog,
  labelNichoCatalog,
  useNichoCatalog,
} from "@/hooks/useNichoCovers";
import type { Nicho } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const CARD_W = 220;

type Contagem = { nicho: string; count: number };

export function DonoNichosCarousel({
  contagens = [],
  light = false,
  className,
}: {
  contagens?: Contagem[];
  light?: boolean;
  className?: string;
}) {
  const catalog = useNichoCatalog();
  const countMap = new Map(contagens.map((c) => [c.nicho, c.count]));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className={cn(
              "text-[13px] font-medium",
              light ? "text-slate-900" : "text-[#f4efe6]"
            )}
          >
            Nichos da plataforma
          </p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Mesmas fotos do app — pause em Fotos nichos para esconder no app
          </p>
        </div>
        <Link
          href="/dono/nichos"
          className="shrink-0 text-[12px] text-slate-500 hover:underline"
        >
          Editar / pausar
        </Link>
      </div>

      <div
        className={cn(
          "flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory",
          "scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {NICHO_CARDS_EXIBICAO.map((id) => {
          const visual = NICHO_CARD_VISUAL[id as Nicho];
          const label = labelNichoCatalog(catalog, id as Nicho);
          const count = countMap.get(id) ?? 0;
          const cover = catalog.covers[id as Nicho] ?? visual.coverImage;
          const remote = cover.startsWith("http");
          const pausado = catalog.pausados.includes(id as Nicho);
          return (
            <Link
              key={id}
              href="/dono/nichos"
              className={cn(
                "group relative flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border text-left transition",
                light
                  ? "border-stone-200 bg-white hover:border-stone-300"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
                pausado && "opacity-60"
              )}
              style={{ width: CARD_W }}
            >
              <div className="relative aspect-[4/3] w-full bg-slate-900">
                {remote ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={label}
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <Image
                    src={cover}
                    alt={label}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    sizes={`${CARD_W}px`}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                {pausado && (
                  <span className="absolute left-2 top-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-black">
                    Pausado
                  </span>
                )}
                <span
                  className={cn(
                    "absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums backdrop-blur-sm",
                    light
                      ? "bg-white/90 text-slate-900"
                      : "bg-black/55 text-[#f4efe6]"
                  )}
                >
                  {count} cliente{count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p
                  className={cn(
                    "text-[13px] font-semibold leading-tight",
                    light ? "text-slate-900" : "text-[#f4efe6]"
                  )}
                >
                  {label}
                </p>
                <p className="line-clamp-2 text-[11px] leading-snug text-slate-500">
                  {descNichoCatalog(catalog, id as Nicho)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
