"use client";

import Image from "next/image";
import { memo, useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Lado pedido ao otimizador (px). */
  size?: number;
};

function isOptimizableRemoteUrl(src: string): boolean {
  return src.startsWith("https://") && src.includes("/storage/v1/object/public/");
}

/**
 * Miniatura lazy: só carrega perto da viewport.
 * Tenta otimização Next (leve); se falhar, usa a URL original.
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
  const [unoptimized, setUnoptimized] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setUnoptimized(false);
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
      { rootMargin: "120px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const canOptimize = isOptimizableRemoteUrl(src);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden bg-slate-900/70", className)}
    >
      {visible && !failed ? (
        canOptimize ? (
          <Image
            key={unoptimized ? "raw" : "opt"}
            src={src}
            alt={alt}
            width={size}
            height={size}
            sizes={`${size}px`}
            unoptimized={unoptimized}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(false);
              if (!unoptimized) {
                setUnoptimized(true);
                return;
              }
              setFailed(true);
            }}
            className={cn(
              "h-full w-full object-cover",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              "h-full w-full object-cover",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
        )
      ) : null}
      {!loaded || failed ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-slate-800/70 text-slate-600"
          aria-hidden={!failed}
        >
          {failed ? <ImageIcon className="h-4 w-4" /> : null}
        </div>
      ) : null}
    </div>
  );
});
