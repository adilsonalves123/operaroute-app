"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "dark" | "light";

type Ctx = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const DonoThemeContext = createContext<Ctx | null>(null);

const KEY = "or_dono_theme";

export function DonoThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved === "light" || saved === "dark") setThemeState(saved);
    } catch {
      // ignore
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);

  return (
    <DonoThemeContext.Provider value={value}>{children}</DonoThemeContext.Provider>
  );
}

export function useDonoTheme() {
  const ctx = useContext(DonoThemeContext);
  if (!ctx) {
    return {
      theme: "dark" as Theme,
      toggle: () => {},
      setTheme: (_t: Theme) => {},
    };
  }
  return ctx;
}
