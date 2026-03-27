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
    <div className="flex flex-col items-end gap-2 text-sm">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "executor" ? null : "executor")}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          Сменить исполнителя
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "deadline" ? null : "deadline")}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          Продлить дедлайн
        </button>
        {executorEmail && (
          <a
            href={`mailto:${executorEmail}?subject=Заказ ${orderId.slice(0, 8)}`}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
          >
            Написать
          </a>
        )}
      </div>
      {open === "deadline" && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
          <input
            type="datetime-local"
            value={newDl}
            onChange={(e) => setNewDl(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={loading}
            onClick={patchDeadline}
            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      )}
      {open === "executor" && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
          <select
            value={execId}
            onChange={(e) => setExecId(e.target.value)}
            className="max-w-[200px] rounded border border-zinc-300 px-2 py-1 text-xs"
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
            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
