"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isSupabaseRealtimeConfigured } from "@/lib/supabase-client";

/** Без Realtime — редкий fallback; при настроенном Realtime не опрашиваем RSC. */
const FALLBACK_MS_NO_REALTIME = 300_000;

/**
 * Раньше вызывал `router.refresh()` часто — полный перерендер RSC.
 * Сейчас: при активном Supabase Realtime компонент ничего не делает.
 * Без Realtime — очень редкий refresh только для экранов без своих подписок (напр. заработок).
 */
export function OrderLiveRefresh({ intervalMs }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (isSupabaseRealtimeConfigured()) return;

    const effective = intervalMs ?? FALLBACK_MS_NO_REALTIME;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      router.refresh();
    };

    const id = setInterval(tick, effective);

    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
