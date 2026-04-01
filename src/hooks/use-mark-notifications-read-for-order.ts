"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "@/lib/query-keys";
import type { NotificationListRow } from "@/lib/notification-realtime-map";

/** Убираем из кеша уведомления по заказу (после PATCH они прочитаны на сервере). */
function removeNotificationsForOrderFromCache(
  orderId: string,
  prev: { notifications: NotificationListRow[] } | undefined,
): { notifications: NotificationListRow[] } {
  const oid = orderId.trim();
  if (!prev?.notifications) return { notifications: [] };
  return {
    notifications: prev.notifications.filter((n) => !n.linkHref?.includes(oid)),
  };
}

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
      queryClient.setQueryData<{ notifications: NotificationListRow[] }>(
        queryKeys.notifications(),
        (old) => removeNotificationsForOrderFromCache(orderId, old),
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    })();
  }, [orderId, queryClient]);
}
