"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import {
  nextOptimizedImageUrl,
  supabaseThumbnailUrl,
} from "@/lib/storage/thumbnail-url";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Lado da miniatura pedida ao Supabase (px). */
  size?: number;
};

type ThumbStage = "supabase" | "next" | "failed";

function resolveThumbSrc(src: string, size: number, stage: ThumbStage): string | null {
  if (stage === "failed") return null;
  if (stage === "next") return nextOptimizedImageUrl(src, size);
  return supabaseThumbnailUrl(src, size);
}

function initialStage(src: string): ThumbStage {
  return supabaseThumbnailUrl(src) ? "supabase" : "next";
}

/**
 * Miniatura leve na lista: Supabase render → proxy Next (pequeno) → ícone.
 * Nunca carrega a foto original inteira no scroll.
 */
export const LazyThumb = memo(function LazyThumb({
  src,
  alt = "",
  className,
  size = 112,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState<ThumbStage>(() => initialStage(src));

  useEffect(() => {
    setLoaded(false);
    setStage(initialStage(src));
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "64px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const imgSrc = useMemo(
    () => resolveThumbSrc(src, size, stage),
    [src, size, stage]
  );

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden bg-slate-900/70", className)}
    >
      {visible && imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${stage}:${imgSrc}`}
          src={imgSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setStage((current) => {
              if (current === "supabase") return "next";
              if (current === "next") return "failed";
              return "failed";
            });
          }}
          className={cn(
            "h-full w-full object-cover",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
      {!loaded ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-slate-800/70 text-slate-600"
          aria-hidden={stage !== "failed"}
        >
          {stage === "failed" ? <ImageIcon className="h-4 w-4" /> : null}
        </div>
      ) : null}
    </div>
  );
});
