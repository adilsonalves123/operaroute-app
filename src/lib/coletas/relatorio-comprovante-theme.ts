import type { CSSProperties } from "react";

/** Tema visual do comprovante — alinhado ao Cassino. */
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

export const RELATORIO_VALUE_STYLES: Record<RelatorioLinhaVariant, CSSProperties> = {
  default: { color: RELATORIO_COLORS.text, fontWeight: 500 },
  discount: { color: RELATORIO_COLORS.orange, fontWeight: 500 },
  highlight: { color: RELATORIO_COLORS.cyan, fontWeight: 700 },
  warning: { color: RELATORIO_COLORS.amber, fontWeight: 500 },
  muted: { color: RELATORIO_COLORS.slate300, fontWeight: 500 },
  success: { color: RELATORIO_COLORS.green, fontWeight: 600 },
};

export const RELATORIO_SHELL_STYLE: CSSProperties = {
  width: 380,
  backgroundColor: RELATORIO_COLORS.bg,
  color: RELATORIO_COLORS.text,
  padding: 20,
  borderRadius: 12,
  border: `1px solid ${RELATORIO_COLORS.border}`,
  boxShadow: "0 25px 50px rgba(0, 0, 0, 0.45)",
  fontFamily: "system-ui, sans-serif",
};
