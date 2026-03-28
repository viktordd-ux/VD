"use client";

import { useEffect } from "react";

/** Отмечает «страницу заказа» просмотренной (файлы, этапы, поля) — не чат. */
export function OrderProjectReadMarker({ orderId }: { orderId: string }) {
  useEffect(() => {
    void (async () => {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markProject: true }),
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("vd:order-unread-changed"));
      }
    })();
  }, [orderId]);

  return null;
}
