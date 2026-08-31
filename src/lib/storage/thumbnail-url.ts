/** Miniatura Supabase Storage (Image Transformations no projeto). */
export function supabaseThumbnailUrl(src: string, size = 112): string | null {
  if (!src?.trim()) return null;

  try {
    const url = new URL(src);
    if (!url.pathname.includes("/storage/v1/object/public/")) return null;

    url.pathname = url.pathname.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
    url.searchParams.set("width", String(size));
    url.searchParams.set("height", String(size));
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", "72");
    return url.toString();
  } catch {
    return null;
  }
}

/** Proxy leve via Next/Vercel — não baixa o original no celular. */
export function nextOptimizedImageUrl(src: string, size = 112): string {
  const w = Math.min(384, Math.max(64, size * 2));
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=70`;
}

/** @deprecated Use supabaseThumbnailUrl ou nextOptimizedImageUrl. */
export function thumbnailUrl(src: string, size = 112): string {
  return supabaseThumbnailUrl(src, size) ?? src;
}
