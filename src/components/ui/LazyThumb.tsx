"use client";

import { memo, useEffect, useRef, useState } from "react";
import { thumbnailUrl } from "@/lib/storage/thumbnail-url";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Lado da miniatura pedida ao Supabase (px). */
  size?: number;
};

/**
 * Miniatura leve: só monta a tag img perto da viewport.
 * Tenta miniatura Supabase primeiro; se falhar, usa a URL original.
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
  const [useOriginal, setUseOriginal] = useState(false);

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
      { rootMargin: "120px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const imgSrc = useOriginal ? src : thumbnailUrl(src, size);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden bg-slate-900/70", className)}
    >
      {visible ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={imgSrc}
          src={imgSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!useOriginal) {
              setUseOriginal(true);
              setLoaded(false);
            }
          }}
          className={cn(
            "h-full w-full object-cover",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
      {!loaded ? (
        <div className="absolute inset-0 bg-slate-800/70" aria-hidden />
      ) : null}
    </div>
  );
});
