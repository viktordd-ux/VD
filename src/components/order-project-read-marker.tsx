"use client";

import { useEffect } from "react";

/** Отмечает «страницу заказа» просмотренной (файлы, этапы, поля) — не чат. */
export function OrderProjectReadMarker({ orderId }: { orderId: string }) {
  useEffect(() => {
    void fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markProject: true }),
    });
  }, [orderId]);

  return null;
}
