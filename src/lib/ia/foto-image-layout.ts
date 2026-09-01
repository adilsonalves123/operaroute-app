import type { CaixaNormalizada } from "@/lib/nichos/cassino/localizar-contadores-ia";
import type { PixelRect } from "@/lib/ia/crop-image";

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

/** Converte um toque na tela em recorte da imagem original (centro no dedo). */
export function pontoDisplayParaRecorte(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  layout: FotoImageLayout,
  naturalWidth: number,
  naturalHeight: number
): PixelRect | null {
  const x = clientX - containerRect.left;
  const y = clientY - containerRect.top;
  const relX = (x - layout.offsetX) / layout.displayW;
  const relY = (y - layout.offsetY) / layout.displayH;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

  const px = relX * naturalWidth;
  const py = relY * naturalHeight;
  const cropW = Math.max(72, Math.min(naturalWidth * 0.28, naturalWidth));
  const cropH = Math.max(36, Math.min(naturalHeight * 0.1, naturalHeight));

  return {
    x: Math.max(0, Math.min(naturalWidth - cropW, px - cropW / 2)),
    y: Math.max(0, Math.min(naturalHeight - cropH, py - cropH / 2)),
    width: cropW,
    height: cropH,
  };
}

export function pixelRectParaDisplay(
  rect: PixelRect,
  layout: FotoImageLayout
): { left: number; top: number; width: number; height: number } {
  return {
    left: layout.offsetX + rect.x * layout.scale,
    top: layout.offsetY + rect.y * layout.scale,
    width: rect.width * layout.scale,
    height: rect.height * layout.scale,
  };
}

export function displayRectParaPixelRect(
  rect: { x: number; y: number; width: number; height: number },
  layout: FotoImageLayout
): PixelRect | null {
  const x1 = rect.x - layout.offsetX;
  const y1 = rect.y - layout.offsetY;
  const x2 = rect.x + rect.width - layout.offsetX;
  const y2 = rect.y + rect.height - layout.offsetY;

  const clampedX1 = Math.max(0, Math.min(layout.displayW, x1));
  const clampedY1 = Math.max(0, Math.min(layout.displayH, y1));
  const clampedX2 = Math.max(0, Math.min(layout.displayW, x2));
  const clampedY2 = Math.max(0, Math.min(layout.displayH, y2));

  const width = clampedX2 - clampedX1;
  const height = clampedY2 - clampedY1;
  if (width < 6 || height < 6) return null;

  return {
    x: clampedX1 / layout.scale,
    y: clampedY1 / layout.scale,
    width: width / layout.scale,
    height: height / layout.scale,
  };
}

/** Imagem em largura total (w-full h-auto). */
export function getFotoImageLayoutFromElement(img: HTMLImageElement): FotoImageLayout | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;
  const displayW = img.clientWidth;
  const displayH = img.clientHeight;
  if (displayW <= 0 || displayH <= 0) return null;
  const scale = displayW / img.naturalWidth;
  return { offsetX: 0, offsetY: 0, displayW, displayH, scale };
}
