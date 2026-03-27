"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Exec = { id: string; name: string; email: string; skills: string[] };

export function RiskOrderActions({
  orderId,
  deadline,
  executorEmail,
  executors,
  currentExecutorId,
}: {
  orderId: string;
  deadline: string | null;
  executorEmail: string | null;
  executors: Exec[];
  currentExecutorId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"deadline" | "executor" | null>(null);
  const [loading, setLoading] = useState(false);
  const [newDl, setNewDl] = useState(
    deadline ? deadline.slice(0, 16) : "",
  );
  const [execId, setExecId] = useState(currentExecutorId ?? "");

  async function patchDeadline() {
    if (!newDl) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: new Date(newDl).toISOString() }),
    });
    setLoading(false);
    if (!res.ok) {
      alert("Не удалось продлить");
      return;
    }
    setOpen(null);
    router.refresh();
  }

  async function patchExecutor() {
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        executorId: execId || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      alert("Не удалось сменить исполнителя");
      return;
    }
    setOpen(null);
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-2 text-sm md:w-auto md:items-end">
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          onClick={() => setOpen(open === "executor" ? null : "executor")}
          className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 sm:min-h-0 sm:w-auto sm:py-1 sm:text-xs"
        >
          Сменить исполнителя
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "deadline" ? null : "deadline")}
          className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 sm:min-h-0 sm:w-auto sm:py-1 sm:text-xs"
        >
          Продлить дедлайн
        </button>
        {executorEmail && (
          <a
            href={`mailto:${executorEmail}?subject=Заказ ${orderId.slice(0, 8)}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 sm:min-h-0 sm:w-auto sm:py-1 sm:text-xs"
          >
            Написать
          </a>
        )}
      </div>
      {open === "deadline" && (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="datetime-local"
            value={newDl}
            onChange={(e) => setNewDl(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base sm:min-h-0 sm:w-auto sm:py-1 sm:text-xs"
          />
          <button
            type="button"
            disabled={loading}
            onClick={patchDeadline}
            className="min-h-11 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 sm:w-auto sm:py-1 sm:text-xs"
          >
            Сохранить
          </button>
        </div>
      )}
      {open === "executor" && (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={execId}
            onChange={(e) => setExecId(e.target.value)}
            className="min-h-11 w-full max-w-none rounded-lg border border-zinc-300 px-3 py-2 text-base sm:max-w-[200px] sm:min-h-0 sm:py-1 sm:text-xs"
          >
            <option value="">—</option>
            {executors.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={patchExecutor}
            className="min-h-11 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 sm:w-auto sm:py-1 sm:text-xs"
          >
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
