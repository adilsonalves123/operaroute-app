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
 * Miniatura que só carrega perto da viewport — evita baixar dezenas de fotos
 * grandes ao abrir o estoque no tablet.
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
      { rootMargin: "240px 0px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const imgSrc = useOriginal ? src : thumbnailUrl(src, size);

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-slate-900/60", className)}>
      {visible ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!useOriginal) {
              setUseOriginal(true);
              setLoaded(false);
            }
          }}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-150",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
      {!loaded ? (
        <div
          className="absolute inset-0 bg-slate-800/70"
          aria-hidden
        />
      ) : null}
    </div>
  );
});
