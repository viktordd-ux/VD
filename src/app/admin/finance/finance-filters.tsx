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

const fieldClass =
  "mt-1 block rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] shadow-sm";

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
    window.setTimeout(() => setBusy(false), 300);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-4 rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-5 shadow-sm shadow-black/[0.06] dark:shadow-black/30"
    >
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
          <IconCalendar />
          Период с
        </label>
        <input
          type="date"
          name="dateFrom"
          defaultValue={initial.dateFrom}
          className={fieldClass}
        />
      </div>
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
          <IconCalendar />
          по
        </label>
        <input
          type="date"
          name="dateTo"
          defaultValue={initial.dateTo}
          className={fieldClass}
        />
      </div>
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
          <IconUser />
          Исполнитель
        </label>
        <select
          name="executorId"
          defaultValue={initial.executorId}
          className={`${fieldClass} min-w-[180px]`}
        >
          <option value="">Все</option>
          {executors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-3 py-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          name="lowMargin"
          defaultChecked={initial.lowMargin}
          className="h-4 w-4 rounded border-[color:var(--border)]"
        />
        <IconAlert />
        Только низкая маржа (&lt; 50%)
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {busy ? "…" : "Применить"}
      </button>
    </form>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}
