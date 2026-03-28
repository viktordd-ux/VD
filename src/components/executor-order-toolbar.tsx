"use client";

import type { OrderStatus } from "@prisma/client";
import { useState } from "react";
import { useExecutorOrder } from "@/components/executor-order/executor-order-context";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/toast-provider";
import { parseCheckpointFromApiJson } from "@/lib/order-client-deserialize";
import { orderStatusLabel } from "@/lib/ui-labels";

export function ExecutorOrderToolbar({ orderId }: { orderId: string }) {
  const { order, setOrder, checkpoints, setCheckpoints, bumpHistory } = useExecutorOrder();
  const toast = useAppToast();
  const [busy, setBusy] = useState(false);

  async function completeAll() {
    if (checkpoints.length === 0) return;
    if (
      !confirm(
        "Сдать все этапы в статусе «Ожидает» на проверку администратору? Заказ перейдёт на проверку только после принятия всех этапов админом.",
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
    if (st) {
      setOrder((o) => ({ ...o, status: st }));
    }
    const cpRes = await fetch(`/api/orders/${orderId}/checkpoints`, { cache: "no-store" });
    if (cpRes.ok) {
      const raw = (await cpRes.json()) as Record<string, unknown>[];
      setCheckpoints(raw.map((x) => parseCheckpointFromApiJson(x)));
    }
    bumpHistory();
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a
        href={`/api/orders/${orderId}/files/archive`}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 sm:min-h-0 sm:py-2"
      >
        Скачать все файлы (ZIP)
      </a>
      {order.status === "IN_PROGRESS" && checkpoints.length > 0 && (
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={busy}
          className="w-full bg-indigo-700 hover:bg-indigo-800 sm:w-auto"
          onClick={() => void completeAll()}
        >
          {busy ? "…" : "Сдать все этапы на проверку"}
        </Button>
      )}
    </div>
  );
}
