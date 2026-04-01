"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query-keys";
import { isSupabaseRealtimeConfigured } from "@/lib/supabase-client";

/** Без Realtime — редкий fallback; при настроенном Realtime не опрашиваем RSC. */
const FALLBACK_MS_NO_REALTIME = 300_000;

/**
 * При активном Supabase Realtime компонент ничего не делает.
 * Без Realtime — редкая инвалидация React Query (каталог заказов, бейджи).
 */
export function OrderLiveRefresh({ intervalMs }: { intervalMs?: number }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isSupabaseRealtimeConfigured()) return;

    const effective = intervalMs ?? FALLBACK_MS_NO_REALTIME;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminOrdersCatalog() });
    };

    const id = setInterval(tick, effective);

    return () => clearInterval(id);
  }, [queryClient, intervalMs]);

  return null;
}
