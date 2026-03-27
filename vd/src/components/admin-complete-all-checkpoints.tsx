"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast-provider";

export function AdminCompleteAllCheckpoints({
  orderId,
  hasCheckpoints,
}: {
  orderId: string;
  hasCheckpoints: boolean;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const [busy, setBusy] = useState(false);

  async function completeAll() {
    if (!hasCheckpoints) return;
    if (!confirm("Отметить все этапы выполненными?")) return;
    setBusy(true);
    const res = await fetch(
      `/api/orders/${orderId}/checkpoints/complete-all`,
      { method: "PATCH" },
    );
    setBusy(false);
    if (!res.ok) {
      toast("Ошибка массового завершения", "error");
      return;
    }
    const data = (await res.json()) as {
      updated: number;
      order?: { status: string } | null;
    };
    toast(
      `Этапов обновлено: ${data.updated}. Статус заказа: ${data.order?.status ?? "—"}`,
      "success",
    );
    router.refresh();
  }

  if (!hasCheckpoints) return null;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void completeAll()}
      className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
    >
      {busy ? "…" : "Завершить все этапы"}
    </button>
  );
}
