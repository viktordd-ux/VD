"use client";

import { cn } from "@/lib/cn";
import type { ThemeMode } from "@/components/theme-provider";
import { useThemeOptional } from "@/components/theme-provider";

function cycle(mode: ThemeMode): ThemeMode {
  if (mode === "system") return "light";
  if (mode === "light") return "dark";
  return "system";
}

/** Компактный переключатель: системная тема → светлая → тёмная. */
export function ThemeToggle({ className }: { className?: string }) {
  const ctx = useThemeOptional();
  if (!ctx) return null;

  const { mode, setMode } = ctx;
  const label =
    mode === "system"
      ? "Тема: как в системе"
      : mode === "light"
        ? "Тема: светлая"
        : "Тема: тёмная";

  return (
    <button
      type="button"
      onClick={() => setMode(cycle(mode))}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] shadow-sm transition-[transform,background-color] duration-200 ease-out hover:bg-zinc-100 active:scale-[0.98] dark:hover:bg-white/10 md:h-9 md:min-w-9",
        className,
      )}
      title={label}
      aria-label={label}
    >
      {mode === "system" ? (
        <IconMonitor className="h-5 w-5 opacity-80" />
      ) : mode === "light" ? (
        <IconSun className="h-5 w-5" />
      ) : (
        <IconMoon className="h-5 w-5" />
      )}
    </button>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function IconMonitor({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
