"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  executors: { id: string; name: string }[];
  initial: {
    dateFrom: string;
    dateTo: string;
    executorId: string;
    lowMargin: boolean;
  };
};

export function FinanceFilters({ executors, initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    const df = String(fd.get("dateFrom") ?? "").trim();
    const dt = String(fd.get("dateTo") ?? "").trim();
    const ex = String(fd.get("executorId") ?? "").trim();
    const lm = fd.get("lowMargin") === "on";
    if (df) p.set("dateFrom", df);
    if (dt) p.set("dateTo", dt);
    if (ex) p.set("executorId", ex);
    if (lm) p.set("lowMargin", "1");
    const qs = p.toString();
    setBusy(true);
    router.push(qs ? `/admin/finance?${qs}` : "/admin/finance");
    router.refresh();
    window.setTimeout(() => setBusy(false), 300);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.06]"
    >
      <div>
        <label className="text-xs font-medium text-zinc-500">Период с</label>
        <input
          type="date"
          name="dateFrom"
          defaultValue={initial.dateFrom}
          className="mt-1 block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-500">по</label>
        <input
          type="date"
          name="dateTo"
          defaultValue={initial.dateTo}
          className="mt-1 block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-500">Исполнитель</label>
        <select
          name="executorId"
          defaultValue={initial.executorId}
          className="mt-1 block min-w-[180px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Все</option>
          {executors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="lowMargin"
          defaultChecked={initial.lowMargin}
          className="rounded border-zinc-300"
        />
        Только низкая маржа (&lt; 50%)
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {busy ? "…" : "Применить"}
      </button>
    </form>
  );
}
