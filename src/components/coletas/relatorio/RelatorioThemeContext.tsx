"use client";

import { createContext, forwardRef, useContext, type CSSProperties, type ReactNode } from "react";
import {
  getRelatorioColors,
  getRelatorioShellStyle,
  getRelatorioValueStyles,
  type RelatorioColors,
  type RelatorioLinhaVariant,
  type RelatorioThemeMode,
} from "@/lib/coletas/relatorio-comprovante-theme";

type RelatorioThemeValue = {
  mode: RelatorioThemeMode;
  colors: RelatorioColors;
  valueStyles: Record<RelatorioLinhaVariant, CSSProperties>;
  shellStyle: CSSProperties;
};

const RelatorioThemeContext = createContext<RelatorioThemeValue | null>(null);

function buildThemeValue(
  mode: RelatorioThemeMode,
  fullWidth?: boolean
): RelatorioThemeValue {
  const colors = getRelatorioColors(mode);
  return {
    mode,
    colors,
    valueStyles: getRelatorioValueStyles(colors),
    shellStyle: getRelatorioShellStyle(mode, { fullWidth }),
  };
}

const DEFAULT_THEME = buildThemeValue("dark");

export function RelatorioThemeProvider({
  theme = "light",
  fullWidth,
  children,
}: {
  theme?: RelatorioThemeMode;
  fullWidth?: boolean;
  children: ReactNode;
}) {
  const value = buildThemeValue(theme, fullWidth);
  return (
    <RelatorioThemeContext.Provider value={value}>{children}</RelatorioThemeContext.Provider>
  );
}

export function useRelatorioTheme(): RelatorioThemeValue {
  return useContext(RelatorioThemeContext) ?? DEFAULT_THEME;
}

export const RelatorioViewRoot = forwardRef<
  HTMLDivElement,
  { theme?: RelatorioThemeMode; fullWidth?: boolean; children: ReactNode }
>(function RelatorioViewRoot({ theme = "light", fullWidth, children }, ref) {
  return (
    <RelatorioThemeProvider theme={theme} fullWidth={fullWidth}>
      <RelatorioViewRootInner ref={ref}>{children}</RelatorioViewRootInner>
    </RelatorioThemeProvider>
  );
});

const RelatorioViewRootInner = forwardRef<HTMLDivElement, { children: ReactNode }>(
  function RelatorioViewRootInner({ children }, ref) {
    const { shellStyle } = useRelatorioTheme();
    return (
      <div ref={ref} style={shellStyle}>
        {children}
      </div>
    );
  }
);
