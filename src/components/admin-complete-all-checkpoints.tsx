"use client";

import type { OrderStatus } from "@prisma/client";
import { useState } from "react";
import { useAdminOrder } from "@/components/admin-order/admin-order-context";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/toast-provider";
import { parseCheckpointFromApiJson } from "@/lib/order-client-deserialize";
import { orderStatusLabel } from "@/lib/ui-labels";

export function AdminCompleteAllCheckpoints({ orderId }: { orderId: string }) {
  const { checkpoints, setCheckpoints, setOrder, bumpHistory } = useAdminOrder();
  const toast = useAppToast();
  const [busy, setBusy] = useState(false);

  async function completeAll() {
    if (checkpoints.length === 0) return;
    if (
      !confirm(
        "Принять все незавершённые этапы? Для каждого будет зафиксирована выплата по указанной сумме этапа.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/checkpoints/complete-all`, {
      method: "PATCH",
      cache: "no-store",
    });
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
    if (st) {
      setOrder((o) => ({ ...o, status: st }));
    }
    const cpRes = await fetch(`/api/orders/${orderId}/checkpoints`, {
      cache: "no-store",
    });
    if (cpRes.ok) {
      const raw = (await cpRes.json()) as Record<string, unknown>[];
      setCheckpoints(raw.map((x) => parseCheckpointFromApiJson(x)));
    }
    bumpHistory();
  }

  if (checkpoints.length === 0) return null;

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
