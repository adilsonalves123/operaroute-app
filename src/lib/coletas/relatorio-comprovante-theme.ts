import type { CSSProperties } from "react";

export type RelatorioThemeMode = "light" | "dark";

/** Tema escuro — impressão / legado. */
export const RELATORIO_COLORS = {
  bg: "#020617",
  card: "#0f172a",
  cardSoft: "rgba(15, 23, 42, 0.8)",
  border: "#334155",
  text: "#ffffff",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  cyan: "#22d3ee",
  green: "#4ade80",
  red: "#f87171",
  amber: "#fbbf24",
  orange: "#fb923c",
  rose: "#fb7185",
} as const;

/** Tema claro — modal e link público (premium banking). */
export const RELATORIO_COLORS_LIGHT = {
  bg: "#faf8f4",
  card: "#ffffff",
  cardSoft: "#f5f2ec",
  border: "rgba(28, 25, 23, 0.12)",
  text: "#1c1917",
  slate300: "#44403c",
  slate400: "#57534e",
  slate500: "#78716c",
  cyan: "#92662a",
  green: "#047857",
  red: "#be123c",
  amber: "#b45309",
  orange: "#c2410c",
  rose: "#be123c",
} as const;

export type RelatorioColors = {
  bg: string;
  card: string;
  cardSoft: string;
  border: string;
  text: string;
  slate300: string;
  slate400: string;
  slate500: string;
  cyan: string;
  green: string;
  red: string;
  amber: string;
  orange: string;
  rose: string;
};

export function getRelatorioColors(theme: RelatorioThemeMode = "light"): RelatorioColors {
  return theme === "light" ? RELATORIO_COLORS_LIGHT : RELATORIO_COLORS;
}

export type RelatorioLinhaVariant =
  | "default"
  | "discount"
  | "highlight"
  | "warning"
  | "muted"
  | "success";

export type RelatorioLinhaComprovante = {
  label: string;
  valor?: string;
  variant?: RelatorioLinhaVariant;
  hint?: string;
  dividerBefore?: boolean;
  secao?: boolean;
  destaque?: boolean;
};

export function getRelatorioValueStyles(
  colors: RelatorioColors
): Record<RelatorioLinhaVariant, CSSProperties> {
  return {
    default: { color: colors.text, fontWeight: 500 },
    discount: { color: colors.orange, fontWeight: 500 },
    highlight: { color: colors.cyan, fontWeight: 700 },
    warning: { color: colors.amber, fontWeight: 500 },
    muted: { color: colors.slate300, fontWeight: 500 },
    success: { color: colors.green, fontWeight: 600 },
  };
}

/** @deprecated use getRelatorioValueStyles(getRelatorioColors()) */
export const RELATORIO_VALUE_STYLES = getRelatorioValueStyles(RELATORIO_COLORS);

export function getRelatorioShellStyle(
  theme: RelatorioThemeMode = "light",
  opts?: { fullWidth?: boolean }
): CSSProperties {
  const colors = getRelatorioColors(theme);
  const isLight = theme === "light";
  return {
    width: opts?.fullWidth ? "100%" : 380,
    maxWidth: opts?.fullWidth ? 420 : undefined,
    backgroundColor: colors.bg,
    color: colors.text,
    padding: 20,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    boxShadow: isLight
      ? "0 4px 24px rgba(28, 25, 23, 0.08)"
      : "0 25px 50px rgba(0, 0, 0, 0.45)",
    fontFamily: "system-ui, sans-serif",
  };
}

/** @deprecated use getRelatorioShellStyle("dark") */
export const RELATORIO_SHELL_STYLE = getRelatorioShellStyle("dark");
