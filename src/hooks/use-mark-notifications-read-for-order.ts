"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "@/lib/query-keys";

/** При входе в карточку заказа помечает связанные уведомления прочитанными. */
export function useMarkNotificationsReadForOrder(
  orderId: string | null | undefined,
) {
  const queryClient = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (!orderId || done.current) return;
    done.current = true;
    void (async () => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
        credentials: "same-origin",
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    })();
  }, [orderId, queryClient]);
}
