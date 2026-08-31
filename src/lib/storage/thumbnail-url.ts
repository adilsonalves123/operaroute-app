/** Miniatura Supabase Storage (menos dados no scroll do estoque). */
export function thumbnailUrl(src: string, size = 112): string {
  if (!src?.trim()) return src;

  try {
    const url = new URL(src);
    if (!url.pathname.includes("/storage/v1/object/public/")) return src;

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
    return src;
  }
}
