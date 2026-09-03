"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppTheme = "dark" | "light";

type Ctx = {
  theme: AppTheme;
  toggle: () => void;
  setTheme: (t: AppTheme) => void;
  ready: boolean;
};

const AppThemeContext = createContext<Ctx | null>(null);

export const APP_THEME_KEY = "or_app_theme";

function applyTheme(t: AppTheme) {
  document.documentElement.dataset.appTheme = t;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(APP_THEME_KEY) as AppTheme | null;
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
        applyTheme(saved);
      } else {
        applyTheme("dark");
      }
    } catch {
      applyTheme("dark");
    }
    setReady(true);
  }, []);

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem(APP_THEME_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, toggle, setTheme, ready }),
    [theme, toggle, setTheme, ready]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    return {
      theme: "dark" as AppTheme,
      toggle: () => {},
      setTheme: (_t: AppTheme) => {},
      ready: false,
    };
  }
  return ctx;
}
