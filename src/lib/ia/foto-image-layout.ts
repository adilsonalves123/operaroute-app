import type { CaixaNormalizada } from "@/lib/nichos/cassino/localizar-contadores-ia";

export type FotoImageLayout = {
  offsetX: number;
  offsetY: number;
  displayW: number;
  displayH: number;
  scale: number;
};

export function getFotoImageLayout(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number
): FotoImageLayout {
  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const displayW = naturalWidth * scale;
  const displayH = naturalHeight * scale;
  const offsetX = (containerWidth - displayW) / 2;
  const offsetY = (containerHeight - displayH) / 2;
  return { offsetX, offsetY, displayW, displayH, scale };
}

export function boxNormalizadaParaDisplay(
  box: CaixaNormalizada,
  layout: FotoImageLayout
): { left: number; top: number; width: number; height: number } {
  const left = layout.offsetX + (box.x / 1000) * layout.displayW;
  const top = layout.offsetY + (box.y / 1000) * layout.displayH;
  const width = (box.width / 1000) * layout.displayW;
  const height = (box.height / 1000) * layout.displayH;
  return { left, top, width, height };
}
