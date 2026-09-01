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
