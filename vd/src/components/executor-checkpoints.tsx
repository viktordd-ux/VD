"use client";

import type { Checkpoint } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast-provider";

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

export function ExecutorCheckpoints({
  checkpoints,
}: {
  checkpoints: Checkpoint[];
}) {
  const router = useRouter();
  const toast = useAppToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(id: string, next: "pending" | "done") {
    setBusy(id);
    const res = await fetch(`/api/checkpoints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    if (!res.ok) {
      toast("Не удалось обновить этап", "error");
      return;
    }
    const data = (await res.json()) as {
      order?: { status: string } | null;
    };
    if (data.order?.status === "REVIEW") {
      toast(
        "Все этапы выполнены — заказ переведён на проверку (REVIEW).",
        "success",
      );
    }
    router.refresh();
  }

  return (
    <div className="relative">
      <ul className="space-y-3 text-sm">
        {checkpoints.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium">{c.title}</span>
              <span className="mt-1 block text-xs text-zinc-500">
                Дедлайн: {dueLabel(c.dueDate)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  c.status === "done"
                    ? "rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"
                    : "rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700"
                }
              >
                {c.status === "done" ? "done" : "pending"}
              </span>
              <button
                type="button"
                disabled={busy === c.id}
                onClick={() =>
                  toggle(c.id, c.status === "done" ? "pending" : "done")
                }
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
              >
                {busy === c.id
                  ? "…"
                  : c.status === "done"
                    ? "Вернуть в pending"
                    : "Отметить выполненным"}
              </button>
            </div>
          </li>
        ))}
        {checkpoints.length === 0 && (
          <li className="text-zinc-500">Чекпоинты не заданы</li>
        )}
      </ul>
    </div>
  );
}
