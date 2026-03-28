"use client";

import type { CheckpointStatus } from "@prisma/client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useExecutorOrder } from "@/components/executor-order/executor-order-context";
import { useAppToast } from "@/components/toast-provider";
import { parseCheckpointFromApiJson } from "@/lib/order-client-deserialize";
import { checkpointStatusLabel } from "@/lib/ui-labels";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function dueLabel(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExecutorCheckpoints() {
  const { checkpoints, setCheckpoints, setOrder, bumpHistory } = useExecutorOrder();
  const toast = useAppToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: "pending" | "awaiting_approval") {
    const prev = checkpoints;
    setCheckpoints((list) =>
      list.map((c) => (c.id === id ? { ...c, status } : c)),
    );

    setBusy(id);
    const res = await fetch(`/api/checkpoints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      cache: "no-store",
    });
    setBusy(null);
    if (!res.ok) {
      setCheckpoints(prev);
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? "Не удалось обновить этап", "error");
      return;
    }
    const body = (await res.json()) as {
      checkpoint: Record<string, unknown>;
      order: { status: string } | null;
    };
    const updated = parseCheckpointFromApiJson(body.checkpoint);
    setCheckpoints((list) => list.map((c) => (c.id === id ? updated : c)));
    if (body.order?.status) {
      setOrder((o) => ({ ...o, status: body.order!.status as typeof o.status }));
    }
    toast(
      status === "awaiting_approval"
        ? "Этап отправлен на проверку администратору"
        : "Изменения сохранены",
      "success",
    );
    bumpHistory();
  }

  return (
    <div className="relative">
      <p className="mb-3 text-xs text-zinc-500">
        Сначала отметьте этап выполненным — он уйдёт на проверку администратору. После принятия
        зафиксируется выплата по сумме этапа.
      </p>
      <ul className="space-y-3 text-sm">
        {checkpoints.map((c) => {
          const amount = Number(c.paymentAmount);
          const badgeTone =
            c.status === "done"
              ? "success"
              : c.status === "awaiting_approval"
                ? "review"
                : "neutral";

          return (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{c.title}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  Дедлайн: {dueLabel(c.dueDate)}
                </span>
                <span className="mt-1 block text-xs text-zinc-600">
                  Оплата этапа: {rub.format(amount)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={badgeTone}>{checkpointStatusLabel[c.status as CheckpointStatus]}</Badge>
                {c.status === "pending" && (
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => void setStatus(c.id, "awaiting_approval")}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {busy === c.id ? "…" : "Сдать на проверку"}
                  </button>
                )}
                {c.status === "awaiting_approval" && (
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => void setStatus(c.id, "pending")}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {busy === c.id ? "…" : "Отозвать"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {checkpoints.length === 0 && (
          <li className="text-zinc-500">Этапы для этого заказа не заданы</li>
        )}
      </ul>
    </div>
  );
}
