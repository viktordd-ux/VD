"use client";

import { useEffect, useState } from "react";
import { isIPhone, isPWA } from "@/lib/pwa";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "vd-ios-pwa-install-banner-dismissed";

/**
 * iPhone в Safari, не в standalone: подсказка «Поделиться → На экран домой».
 */
export function IosPwaInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
      if (!isIPhone() || isPWA()) return;
      setVisible(true);
    } catch {
      if (isIPhone() && !isPWA()) setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-[100] border-b border-amber-200/90 bg-amber-50 px-3 py-2.5 text-center text-sm text-amber-950",
        "pt-[max(0.625rem,env(safe-area-inset-top))]",
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-1 sm:flex-row sm:items-center sm:justify-center sm:gap-2">
        <span>
          <span className="font-medium">Установите приложение:</span> нажмите кнопку{" "}
          <span className="font-medium">Поделиться</span> в Safari, затем{" "}
          <span className="font-medium">На экран «Домой»</span>
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
