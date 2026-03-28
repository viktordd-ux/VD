"use client";

import { useState } from "react";
import { useAdminOrder } from "@/components/admin-order/admin-order-context";
import { Button } from "@/components/ui/button";
import { parseAdminOrderFromApiJson } from "@/lib/order-client-deserialize";

export function AdminAutoAssignButton({ orderId }: { orderId: string }) {
  const { setOrder, bumpHistory } = useAdminOrder();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/auto-assign`, {
      method: "POST",
      cache: "no-store",
    });
    setLoading(false);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Не удалось назначить");
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    setOrder(parseAdminOrderFromApiJson(data));
    bumpHistory();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "…" : "Назначить автоматически"}
    </Button>
  );
}
