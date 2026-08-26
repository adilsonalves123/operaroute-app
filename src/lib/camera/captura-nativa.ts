"use client";

import { Capacitor } from "@capacitor/core";
import { isNativeAndroidApp } from "@/lib/push/client";

type ModoCaptura = "camera" | "galeria";

function base64ToFile(base64: string, ext: "jpg" | "png" | "webp" = "jpg"): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new File([bytes], `foto-${Date.now()}.${ext}`, { type: mime });
}

function blobToFile(blob: Blob): File {
  const ext = blob.type.includes("png")
    ? "png"
    : blob.type.includes("webp")
      ? "webp"
      : "jpg";
  return new File([blob], `foto-${Date.now()}.${ext}`, {
    type: blob.type || "image/jpeg",
  });
}

async function webPathParaFile(webPath: string): Promise<File | null> {
  const urls = [Capacitor.convertFileSrc(webPath), webPath];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return blobToFile(await res.blob());
    } catch {
      /* tenta próximo */
    }
  }
  return null;
}

async function garantirPermissaoCamera(
  CapCamera: typeof import("@capacitor/camera").Camera
): Promise<void> {
  const permission = await CapCamera.checkPermissions();
  if (permission.camera === "granted") return;

  const next = await CapCamera.requestPermissions({ permissions: ["camera"] });
  if (next.camera !== "granted") {
    throw new Error(
      "Permissão da câmera negada. Ative em Configurações → Apps → OperaRoute → Câmera."
    );
  }
}

async function garantirPermissaoGaleria(
  CapCamera: typeof import("@capacitor/camera").Camera
): Promise<void> {
  const permission = await CapCamera.checkPermissions();
  if (permission.photos === "granted" || permission.photos === "limited") return;
  await CapCamera.requestPermissions({ permissions: ["photos"] });
}

function erroCancelado(msg: string): boolean {
  return /cancel|dismiss|user cancelled|no picture taken|no photo/i.test(msg);
}

async function capturarComApiNova(modo: ModoCaptura): Promise<File | null> {
  const { Camera: CapCamera, MediaTypeSelection } = await import("@capacitor/camera");

  if (modo === "camera") {
    await garantirPermissaoCamera(CapCamera);
    const result = await CapCamera.takePhoto({
      quality: 85,
      correctOrientation: true,
      editable: "no",
    });

    if (result.webPath) {
      const file = await webPathParaFile(result.webPath);
      if (file) return file;
    }
    if (result.thumbnail) {
      return base64ToFile(result.thumbnail);
    }
    return null;
  }

  await garantirPermissaoGaleria(CapCamera);
  const { results } = await CapCamera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: false,
  });
  const item = results?.[0];
  if (!item) return null;

  if (item.webPath) {
    const file = await webPathParaFile(item.webPath);
    if (file) return file;
  }
  if (item.thumbnail) {
    return base64ToFile(item.thumbnail);
  }
  return null;
}

async function capturarComGetPhoto(modo: ModoCaptura): Promise<File | null> {
  const {
    Camera: CapCamera,
    CameraResultType,
    CameraSource,
  } = await import("@capacitor/camera");

  if (modo === "camera") {
    await garantirPermissaoCamera(CapCamera);
  } else {
    await garantirPermissaoGaleria(CapCamera);
  }

  const photo = await CapCamera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Base64,
    source: modo === "camera" ? CameraSource.Camera : CameraSource.Photos,
    correctOrientation: true,
  });

  if (photo.base64String) {
    const ext =
      photo.format === "png" ? "png" : photo.format === "webp" ? "webp" : "jpg";
    return base64ToFile(photo.base64String, ext);
  }

  if (photo.webPath) {
    return webPathParaFile(photo.webPath);
  }

  return null;
}

/**
 * Abre câmera ou galeria via plugin nativo do Capacitor (app Android).
 * Não usa `<input capture>` — evita abrir galeria em aparelhos problemáticos.
 */
export async function capturarFotoNativa(modo: ModoCaptura): Promise<File | null> {
  if (!isNativeAndroidApp()) {
    throw new Error("Captura nativa só funciona no app Android.");
  }

  if (!Capacitor.isPluginAvailable("Camera")) {
    throw new Error(
      "Câmera nativa indisponível. Instale o APK mais recente do OperaRoute (1.0.7+)."
    );
  }

  try {
    return await capturarComApiNova(modo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (erroCancelado(msg)) return null;

    try {
      return await capturarComGetPhoto(modo);
    } catch (legacyErr) {
      const legacyMsg =
        legacyErr instanceof Error ? legacyErr.message : String(legacyErr);
      if (erroCancelado(legacyMsg)) return null;
      throw new Error(
        legacyMsg.includes("camera activity") || legacyMsg.includes("NO_CAMERA")
          ? "Não foi possível abrir a câmera neste aparelho. Confira se o OperaRoute tem permissão de câmera."
          : legacyMsg || msg
      );
    }
  }
}
