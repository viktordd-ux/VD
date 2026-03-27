"use client";

import type { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/toast-provider";
import { orderStatusLabel } from "@/lib/ui-labels";

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
    if (
      !confirm(
        "Принять все незавершённые этапы? Для каждого будет зафиксирована выплата по указанной сумме этапа.",
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
      toast("Ошибка массового завершения", "error");
      return;
    }
    const data = (await res.json()) as {
      updated: number;
      order?: { status: string } | null;
    };
    const st = data.order?.status as OrderStatus | undefined;
    toast(
      data.updated
        ? `Принято этапов: ${data.updated}. Статус заказа: ${st ? orderStatusLabel[st] : "—"}`
        : "Все этапы уже приняты",
      "success",
    );
    router.refresh();
  }

  if (!hasCheckpoints) return null;

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={busy}
      className="border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
      onClick={() => void completeAll()}
    >
      {busy ? "…" : "Принять все этапы"}
    </Button>
  );
}
