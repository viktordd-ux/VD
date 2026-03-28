"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";

/**
 * Оверлей при переходах по внутренним ссылкам: старт по клику, конец по смене URL.
 * Дополняет loading.tsx (Suspense), когда навигация без клика по <a> (router.push и т.д.).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const routeKeyRef = useRef(`${pathname}?${searchParams?.toString() ?? ""}`);

  useEffect(() => {
    const key = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (routeKeyRef.current !== key) {
      routeKeyRef.current = key;
      setBusy(false);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!busy) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [busy]);

  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest("a");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      if (el.getAttribute("target") === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      try {
        const next = new URL(href, window.location.href);
        if (next.origin !== window.location.origin) return;
        const cur = `${window.location.pathname}${window.location.search}`;
        const dest = `${next.pathname}${next.search}`;
        if (cur === dest) return;
        setBusy(true);
      } catch {
        // ignore
      }
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  if (!busy) return null;

  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-50/85 backdrop-blur-[2px]"
      role="progressbar"
      aria-busy="true"
      aria-live="polite"
      aria-label="Загрузка страницы"
    >
      <div className="rounded-2xl border border-zinc-200/90 bg-white px-10 py-8 shadow-lg shadow-zinc-950/10">
        <PageLoadingSkeleton compact />
      </div>
    </div>
  );
}
