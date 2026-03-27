"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DEFAULT_MS = 3000;

/**
 * Периодически вызывает `router.refresh()` для серверных страниц заказов/списков,
 * чтобы админ и исполнитель видели изменения друг друга без ручного F5.
 * Пока вкладка скрыта — опрос не крутит запросы.
 */
export function OrderLiveRefresh({ intervalMs = DEFAULT_MS }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      router.refresh();
    };

    const id = setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
