export type AnaliseVisualTema = "escuro" | "claro";

export function parseAnaliseVisualTema(raw?: string | null): AnaliseVisualTema {
  return raw === "claro" ? "claro" : "escuro";
}

export function appThemeToAnaliseVisual(theme: "dark" | "light"): AnaliseVisualTema {
  return theme === "light" ? "claro" : "escuro";
}

export function analisePageBackground(tema: AnaliseVisualTema): string {
  if (tema === "claro") {
    return "linear-gradient(180deg, #faf8f4 0%, #f3efe6 48%, #ebe6dc 100%)";
  }
  return "radial-gradient(ellipse 85% 50% at 50% -8%, rgba(196,165,116,0.14), transparent 55%), radial-gradient(ellipse 45% 35% at 95% 25%, rgba(16,185,129,0.05), transparent 50%), radial-gradient(ellipse 40% 30% at 5% 70%, rgba(120,90,50,0.1), transparent 45%), linear-gradient(180deg, #06080e 0%, #0a0e16 50%, #07090f 100%)";
}

export function periodoSelectorTema(
  visual: AnaliseVisualTema
): "premium" | "claro" | "default" {
  if (visual === "claro") return "claro";
  return "premium";
}
