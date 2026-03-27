"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast-provider";

export function ExecutorOrderToolbar({
  orderId,
  status,
  hasCheckpoints,
}: {
  orderId: string;
  status: string;
  hasCheckpoints: boolean;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const [busy, setBusy] = useState(false);

  async function completeAll() {
    if (!hasCheckpoints) return;
    if (
      !confirm(
        "Отметить все этапы выполненными? При необходимости заказ уйдёт в REVIEW.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(
      `/api/orders/${orderId}/checkpoints/complete-all`,
      { method: "PATCH" },
    );
    setBusy(false);
    if (!res.ok) {
      toast("Не удалось завершить этапы", "error");
      return;
    }
    const data = (await res.json()) as {
      updated: number;
      order?: { status: string } | null;
    };
    toast(
      data.updated
        ? `Завершено этапов: ${data.updated}. Статус: ${data.order?.status ?? "—"}`
        : "Все этапы уже были выполнены",
      "success",
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={`/api/orders/${orderId}/files/archive`}
        className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
      >
        Скачать все файлы (ZIP)
      </a>
      {status === "IN_PROGRESS" && hasCheckpoints && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void completeAll()}
          className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-60"
        >
          {busy ? "…" : "Завершить все этапы"}
        </button>
      )}
    </div>
  );
}
