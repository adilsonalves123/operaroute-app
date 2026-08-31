"use client";

import { memo, useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
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
 * Se a miniatura Supabase falhar, mostra ícone — não baixa a foto original (2–5 MB).
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
  const [failed, setFailed] = useState(false);

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
      { rootMargin: "80px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const imgSrc = thumbnailUrl(src, size);

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden bg-slate-900/70",
        className
      )}
    >
      {visible && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full object-cover",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
      {!loaded || failed ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-slate-800/80 text-slate-600"
          aria-hidden={!failed}
        >
          {failed ? <ImageIcon className="h-4 w-4" /> : null}
        </div>
      ) : null}
    </div>
  );
});
