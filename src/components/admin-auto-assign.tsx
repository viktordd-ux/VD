"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminAutoAssignButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}/auto-assign`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Не удалось назначить");
      return;
    }
    router.refresh();
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
