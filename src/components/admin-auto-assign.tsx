"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
    >
      {loading ? "…" : "Назначить автоматически"}
    </button>
  );
}
