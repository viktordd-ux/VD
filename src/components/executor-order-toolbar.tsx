"use client";

import type { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/toast-provider";
import { orderStatusLabel } from "@/lib/ui-labels";

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
        "Сдать все этапы в статусе «Ожидает» на проверку администратору? Заказ перейдёт на проверку только после принятия всех этапов админом.",
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
    const st = data.order?.status as OrderStatus | undefined;
    toast(
      data.updated
        ? `Отправлено на проверку этапов: ${data.updated}. Статус заказа: ${st ? orderStatusLabel[st] : "—"}`
        : "Нет этапов в статусе «Ожидает» для отправки",
      "success",
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={`/api/orders/${orderId}/files/archive`}
        className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50"
      >
        Скачать все файлы (ZIP)
      </a>
      {status === "IN_PROGRESS" && hasCheckpoints && (
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={busy}
          className="bg-indigo-700 hover:bg-indigo-800"
          onClick={() => void completeAll()}
        >
          {busy ? "…" : "Сдать все этапы на проверку"}
        </Button>
      )}
    </div>
  );
}
