"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OrderRowQuickActions({
  orderId,
  status,
  checkpointCount,
}: {
  orderId: string;
  status: string;
  checkpointCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() =>
          run("assign", async () => {
            const res = await fetch(`/api/orders/${orderId}/auto-assign`, {
              method: "POST",
            });
            if (!res.ok) {
              alert((await res.json().catch(() => ({}))).error ?? "Ошибка");
            }
          })
        }
        className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        title="Назначить лучшего исполнителя"
      >
        {busy === "assign" ? "…" : "Авто"}
      </button>
      {checkpointCount > 0 && status === "IN_PROGRESS" && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run("cp", async () => {
              const res = await fetch(
                `/api/orders/${orderId}/checkpoints/complete-all`,
                { method: "PATCH" },
              );
              if (!res.ok) alert("Не удалось завершить этапы");
            })
          }
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          title="Завершить все чекпоинты"
        >
          {busy === "cp" ? "…" : "Этапы"}
        </button>
      )}
      {status !== "REVIEW" && status !== "DONE" && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run("review", async () => {
              const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "REVIEW" }),
              });
              if (!res.ok) alert("Не удалось перевести в REVIEW");
            })
          }
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy === "review" ? "…" : "REVIEW"}
        </button>
      )}
      {status !== "DONE" && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run("done", async () => {
              const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "DONE" }),
              });
              if (!res.ok) alert("Не удалось перевести в DONE");
            })
          }
          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
        >
          {busy === "done" ? "…" : "DONE"}
        </button>
      )}
    </div>
  );
}
