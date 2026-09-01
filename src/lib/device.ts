/** iPhone/iPad no Safari ou Chrome iOS. */
export function isIOSBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iosDevice = /iPad|iPhone|iPod/.test(ua);
  const ipadOs =
    navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints === "number"
      ? navigator.maxTouchPoints > 1
      : false;
  return iosDevice || ipadOs;
}

/** Tablet/touch grande (Android etc.) — precisa do recorte visual explícito. */
export function isTouchTablet(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const minSide = Math.min(window.screen.width, window.screen.height);
  return coarse && minSide >= 600 && !isIOSBrowser();
}
