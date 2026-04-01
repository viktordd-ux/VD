"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/cn";

type Variant = "admin" | "executor";

function SidebarBrand({ variant }: { variant: Variant }) {
  return (
    <div className="border-b border-[color:var(--border)] px-4 py-4">
      <span className="text-lg font-bold tracking-tight text-[var(--text)]">
        V<span className="font-semibold text-[var(--muted)]">|</span>D
      </span>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
        {variant === "admin" ? "Админ" : "Исполнитель"}
      </p>
    </div>
  );
}

export function ResponsiveAppShell({
  variant,
  sidebarNav,
  bottomNav,
  /** Кнопки справа в мобильной шапке (тема, уведомления и т.д.). */
  mobileHeaderActions,
  children,
}: {
  variant: Variant;
  sidebarNav: React.ReactNode;
  /** Нижняя навигация (например PWA / мобильный админ). */
  bottomNav?: React.ReactNode;
  mobileHeaderActions?: React.ReactNode;
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
    <div className="flex min-h-full min-w-0 flex-1 bg-[var(--bg)] md:min-h-dvh">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-[color:var(--border)] bg-[var(--card)]/95 backdrop-blur-sm md:flex">
        <SidebarBrand variant={variant} />
        {sidebarNav}
        <div className="mt-auto border-t border-[color:var(--border)] p-2.5">
          <SignOutButton />
        </div>
      </aside>

      <div
        className={cn("fixed inset-0 z-[100] md:hidden", open ? "block" : "hidden")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 bg-black/50 transition-opacity dark:bg-black/60"
          onClick={() => setOpen(false)}
          aria-label="Закрыть меню"
        />
        <aside
          id="app-mobile-drawer"
          className={cn(
            "absolute inset-y-0 left-0 z-10 flex w-[min(100%,18rem)] flex-col border-r border-[color:var(--border)] bg-[var(--card)] shadow-xl transition-transform duration-200 ease-out",
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
        <header className="sticky top-0 z-40 flex min-h-[3.25rem] items-center gap-2 border-b border-[color:var(--border)] bg-[var(--card)]/90 px-2 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--card)]/80 md:hidden">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] text-[var(--text)] transition-colors hover:bg-[color:var(--muted-bg)] active:scale-[0.98]"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="app-mobile-drawer"
            aria-label="Открыть меню"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-[var(--text)]">
              V<span className="font-semibold text-[var(--muted)]">|</span>D
            </p>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              {variant === "admin" ? "Админ" : "Исполнитель"}
            </p>
          </div>
          {mobileHeaderActions ? (
            <div className="flex shrink-0 items-center gap-1">{mobileHeaderActions}</div>
          ) : null}
        </header>
        <main
          id="app-main"
          className={cn(
            /* Скролл у window/body; без flex-1 — иначе main растягивается на экран и скролл «ломается». */
            "min-w-0 overflow-x-hidden px-6 py-8 md:px-10 md:py-10 lg:px-12 lg:py-12",
            bottomNav != null &&
              "max-md:pb-[calc(5rem+env(safe-area-inset-bottom,0px))]",
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
