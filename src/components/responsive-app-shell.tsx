"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/cn";

type Variant = "admin" | "executor";

function SidebarBrand({ variant }: { variant: Variant }) {
  return (
    <div className="border-b border-[color:var(--border)] px-3 py-3.5">
      <span className="text-lg font-semibold tracking-tight text-[var(--text)]">
        V<span className="text-[var(--muted)]">|</span>D
      </span>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        {variant === "admin" ? "Админ" : "Исполнитель"}
      </p>
    </div>
  );
}

export function ResponsiveAppShell({
  variant,
  sidebarNav,
  bottomNav,
  children,
}: {
  variant: Variant;
  sidebarNav: React.ReactNode;
  /** Нижняя навигация (например PWA / мобильный админ). */
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="flex min-h-full min-w-0 flex-1 bg-[var(--bg)]">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-[color:var(--border)] bg-[var(--card)] md:flex">
        <SidebarBrand variant={variant} />
        {sidebarNav}
        <div className="mt-auto border-t border-[color:var(--border)] p-2.5">
          <SignOutButton />
        </div>
      </aside>

      <div
        className={cn("fixed inset-0 z-50 md:hidden", open ? "block" : "hidden")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="absolute inset-0 z-40 bg-black/50 transition-opacity dark:bg-black/60"
          onClick={() => setOpen(false)}
          aria-label="Закрыть меню"
        />
        <aside
          id="app-mobile-drawer"
          className={cn(
            "absolute inset-y-0 left-0 z-50 flex w-[min(100%,18rem)] flex-col border-r border-[color:var(--border)] bg-[var(--card)] shadow-xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-[color:var(--border)]">
            <div className="min-w-0 flex-1">
              <SidebarBrand variant={variant} />
            </div>
            <button
              type="button"
              aria-label="Закрыть меню"
              className="m-2 shrink-0 rounded-lg p-2.5 text-[var(--muted)] transition-colors hover:bg-[color:var(--muted-bg)]"
              onClick={() => setOpen(false)}
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            {sidebarNav}
          </div>
          <div className="border-t border-[color:var(--border)] p-3">
            <SignOutButton />
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[3.5rem] items-center gap-3 border-b border-[color:var(--border)] bg-[var(--card)]/90 px-3 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--card)]/80 md:hidden">
          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] text-[var(--text)] transition-colors hover:bg-[color:var(--muted-bg)] active:scale-[0.98]"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="app-mobile-drawer"
            aria-label="Открыть меню"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text)]">
              V<span className="text-[var(--muted)]">|</span>D
            </p>
            <p className="text-xs text-[var(--muted)]">
              {variant === "admin" ? "Админ" : "Исполнитель"}
            </p>
          </div>
        </header>
        <main
          id="app-main"
          className={cn(
            "min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10",
            bottomNav != null
              ? "pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-8 lg:pb-10"
              : undefined,
          )}
        >
          {children}
        </main>
        {bottomNav}
      </div>
    </div>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
