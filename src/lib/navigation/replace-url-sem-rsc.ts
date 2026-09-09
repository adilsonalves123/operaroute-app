/**
 * Troca a URL no histórico sem disparar navegação RSC.
 * `router.replace` no App Router aciona `(app)/loading.tsx` (splash OperaRoute)
 * e, se outra navegação começar em seguida, a tela pode ficar presa nisso.
 */
export function replaceUrlSemRsc(href: string) {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state ?? {}, "", href);
}
