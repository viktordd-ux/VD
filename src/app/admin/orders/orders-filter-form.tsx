"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveOrdersFiltersQuery } from "./orders-filter-hydration";

const RISK_OPTIONS = [
  { value: "revision", label: "Правки > 2" },
  { value: "deadline", label: "Просрочен дедлайн заказа" },
  { value: "checkpoint", label: "Просрочен чекпоинт" },
  { value: "silent_warn", label: "Тишина (предупреждение)" },
  { value: "silent_high", label: "Тишина (высокий риск)" },
] as const;

const STATUS_OPTIONS = [
  { value: "LEAD", label: "Лид" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "REVIEW", label: "На проверке" },
  { value: "DONE", label: "Завершён" },
] as const;

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Обновление ↓" },
  { value: "deadline_asc", label: "Дедлайн ↑" },
  { value: "deadline_desc", label: "Дедлайн ↓" },
  { value: "profit_asc", label: "Прибыль ↑" },
  { value: "profit_desc", label: "Прибыль ↓" },
  { value: "margin_asc", label: "Маржа % ↑" },
  { value: "margin_desc", label: "Маржа % ↓" },
] as const;

const FILTER_TABS = [
  { value: "active", label: "Активные" },
  { value: "done", label: "Завершённые" },
  { value: "all", label: "Все" },
] as const;

type Props = {
  allSkills: string[];
  initial: {
    filter: string;
    lowMargin: boolean;
    skills: string[];
    status: string[];
    risk: string[];
    sort: string;
    deadlineAfter: string;
    deadlineBefore: string;
    skillsMode: "any" | "all";
  };
};

export function OrdersFilterForm({ allSkills, initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [skills, setSkills] = useState<Set<string>>(
    () => new Set(initial.skills),
  );
  const [status, setStatus] = useState<Set<string>>(
    () => new Set(initial.status),
  );
  const [risk, setRisk] = useState<Set<string>>(() => new Set(initial.risk));
  const [skillsMode, setSkillsMode] = useState<"any" | "all">(
    initial.skillsMode,
  );

  const hrefBase = useMemo(() => "/admin/orders", []);

  function buildQuery(next: {
    filter: string;
    lowMargin: boolean;
    skills: Set<string>;
    status: Set<string>;
    risk: Set<string>;
    sort: string;
    deadlineAfter: string;
    deadlineBefore: string;
    skillsMode: "any" | "all";
  }) {
    const p = new URLSearchParams();
    p.set("filter", next.filter);
    if (next.lowMargin) p.set("lowMargin", "1");
    if (next.skills.size) p.set("skills", [...next.skills].join(","));
    if (next.status.size) p.set("status", [...next.status].join(","));
    if (next.risk.size) p.set("risk", [...next.risk].join(","));
    if (next.sort && next.sort !== "updated_desc") p.set("sort", next.sort);
    if (next.deadlineAfter.trim()) p.set("deadlineAfter", next.deadlineAfter.trim());
    if (next.deadlineBefore.trim()) {
      p.set("deadlineBefore", next.deadlineBefore.trim());
    }
    if (next.skillsMode === "all") p.set("skillsMode", "all");
    const q = p.toString();
    return q ? `${hrefBase}?${q}` : hrefBase;
  }

  function applyFromForm(fd: FormData) {
    const filter = String(fd.get("filter") ?? "active");
    const lowMargin = fd.get("lowMargin") === "on";
    const sort = String(fd.get("sort") ?? "updated_desc");
    const deadlineAfter = String(fd.get("deadlineAfter") ?? "");
    const deadlineBefore = String(fd.get("deadlineBefore") ?? "");
    const href = buildQuery({
      filter,
      lowMargin,
      skills,
      status,
      risk,
      sort,
      deadlineAfter,
      deadlineBefore,
      skillsMode,
    });
    const qs = href.includes("?") ? href.split("?")[1] ?? "" : "";
    saveOrdersFiltersQuery(qs);
    setBusy(true);
    router.push(href);
    router.refresh();
    window.setTimeout(() => setBusy(false), 300);
  }

  function toggleSkill(s: string) {
    setSkills((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  }

  function toggleStatus(s: string) {
    setStatus((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  }

  function toggleRisk(s: string) {
    setRisk((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyFromForm(new FormData(e.currentTarget));
      }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.06] sm:p-5"
    >
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((t) => (
          <label
            key={t.value}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white"
          >
            <input
              type="radio"
              name="filter"
              value={t.value}
              defaultChecked={initial.filter === t.value}
              className="sr-only"
            />
            {t.label}
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-zinc-500">Сортировка</label>
          <select
            name="sort"
            defaultValue={initial.sort}
            className="mt-1 block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base sm:min-h-0 sm:py-2 sm:text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-zinc-500">
            Дедлайн от
          </label>
          <input
            type="date"
            name="deadlineAfter"
            defaultValue={initial.deadlineAfter}
            className="mt-1 block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base sm:min-h-0 sm:py-2 sm:text-sm"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-zinc-500">
            Дедлайн до
          </label>
          <input
            type="date"
            name="deadlineBefore"
            defaultValue={initial.deadlineBefore}
            className="mt-1 block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base sm:min-h-0 sm:py-2 sm:text-sm"
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm sm:min-h-0">
          <input
            type="checkbox"
            name="lowMargin"
            defaultChecked={initial.lowMargin}
            className="rounded border-zinc-300"
          />
          Низкая маржа (&lt; 50%)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto sm:py-2"
        >
          {busy ? "…" : "Применить"}
        </button>
      </div>

      {allSkills.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium text-zinc-500">Навыки исполнителя</p>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input
                type="radio"
                name="skillsModeRadio"
                checked={skillsMode === "any"}
                onChange={() => setSkillsMode("any")}
              />
              хотя бы один
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input
                type="radio"
                name="skillsModeRadio"
                checked={skillsMode === "all"}
                onChange={() => setSkillsMode("all")}
              />
              все выбранные
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {allSkills.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSkill(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  skills.has(s)
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-zinc-500">Статус заказа</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                status.has(s.value)
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-500">Риски</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RISK_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleRisk(r.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                risk.has(r.value)
                  ? "bg-amber-200 text-amber-950"
                  : "border border-amber-200 bg-white text-amber-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
