"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "vd-theme";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    /** Старый режим «system» и пустое значение — один раз фиксируем явную тему. */
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next: ThemeMode = dark ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    /* ignore */
  }
  return "light";
}

export function resolveDark(mode: ThemeMode): boolean {
  return mode === "dark";
}

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

let listeners = new Set<() => void>();

function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emitTheme() {
  for (const l of listeners) l();
}

function readSnapshot(): ThemeMode {
  return getStoredTheme();
}

function readServerSnapshot(): ThemeMode {
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribeTheme, readSnapshot, readServerSnapshot);
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) emitTheme();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    function sync() {
      const dark = resolveDark(mode);
      applyDarkClass(dark);
      setResolvedDark(dark);
    }
    sync();
  }, [mode]);

  /** Синхронизация `theme-color` с выбранной темой (PWA / Chrome bar), т.к. статический viewport не знает про `vd-theme`. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const color = resolveDark(mode) ? "#0c0e12" : "#fafafa";
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    emitTheme();
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      resolvedDark,
    }),
    [mode, setMode, resolvedDark],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

const ThemeContext = createContext<{
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  resolvedDark: boolean;
} | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

export function useThemeOptional() {
  return useContext(ThemeContext);
}
