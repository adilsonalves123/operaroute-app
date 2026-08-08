"use client";

import { FileText, Download } from "lucide-react";
import { isImagemMime } from "@/lib/suporte/anexos";
import { cn } from "@/lib/utils";

export function SuporteAnexoBloco({
  url,
  nome,
  mime,
  tamanho,
  className,
}: {
  url: string;
  nome?: string | null;
  mime?: string | null;
  tamanho?: number | null;
  className?: string;
}) {
  const label = nome || "Arquivo";
  const sizeLabel =
    tamanho && tamanho > 0
      ? tamanho >= 1024 * 1024
        ? `${(tamanho / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(tamanho / 1024))} KB`
      : null;

  if (isImagemMime(mime) || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn("mt-2 block overflow-hidden rounded-sm border border-white/10", className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="max-h-56 w-full object-contain bg-black/30" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "mt-2 flex items-center gap-2.5 rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-[#e8d5b0] transition hover:border-[#c4a574]/35",
        className
      )}
    >
      <FileText className="h-4 w-4 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {sizeLabel && <span className="shrink-0 text-slate-500">{sizeLabel}</span>}
      <Download className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </a>
  );
}
