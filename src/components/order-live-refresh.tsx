"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isSupabaseRealtimeConfigured } from "@/lib/supabase-client";

/** Без Realtime — периодический опрос; с Realtime — только редкий fallback. */
const DEFAULT_MS = 30_000;
const WITH_REALTIME_FALLBACK_MS = 120_000;

/**
 * Периодически вызывает `router.refresh()` для страниц без собственных подписок (напр. «Заработок»).
 * При настроенном Supabase Realtime интервал по умолчанию редкий — основные экраны обновляют state сами.
 */
export function OrderLiveRefresh({ intervalMs }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const effective =
      intervalMs ??
      (isSupabaseRealtimeConfigured() ? WITH_REALTIME_FALLBACK_MS : DEFAULT_MS);

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      router.refresh();
    };

    const id = setInterval(tick, effective);

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
