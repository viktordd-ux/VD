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

const fieldClass =
  "mt-1 block min-h-11 w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-base text-[var(--text)] shadow-sm placeholder:text-[var(--muted)] sm:min-h-0 sm:py-2 sm:text-sm";

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
    priority: string;
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
    priority: string;
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
    if (next.priority === "high" || next.priority === "medium" || next.priority === "low") {
      p.set("priority", next.priority);
    }
    const q = p.toString();
    return q ? `${hrefBase}?${q}` : hrefBase;
  }

  function applyFromForm(fd: FormData) {
    const filter = String(fd.get("filter") ?? "active");
    const lowMargin = fd.get("lowMargin") === "on";
    const sort = String(fd.get("sort") ?? "updated_desc");
    const deadlineAfter = String(fd.get("deadlineAfter") ?? "");
    const deadlineBefore = String(fd.get("deadlineBefore") ?? "");
    const priority = String(fd.get("priority") ?? "");
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
      priority,
    });
    const qs = href.includes("?") ? href.split("?")[1] ?? "" : "";
    saveOrdersFiltersQuery(qs);
    setBusy(true);
    router.push(href);
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
      className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-4 shadow-sm shadow-black/[0.06] dark:shadow-black/30 sm:p-5"
    >
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((t) => (
          <label
            key={t.value}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-3 py-1.5 text-sm text-[var(--text)] transition-colors has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white dark:has-[:checked]:border-white dark:has-[:checked]:bg-white dark:has-[:checked]:text-zinc-900"
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
          <label className="text-xs font-medium text-[var(--muted)]">Приоритет (авто)</label>
          <select name="priority" defaultValue={initial.priority || ""} className={fieldClass}>
            <option value="">Все</option>
            <option value="high">Срочно</option>
            <option value="medium">Внимание</option>
            <option value="low">Обычный</option>
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-[var(--muted)]">Сортировка</label>
          <select name="sort" defaultValue={initial.sort} className={fieldClass}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-[var(--muted)]">
            Дедлайн от
          </label>
          <input
            type="date"
            name="deadlineAfter"
            defaultValue={initial.deadlineAfter}
            className={fieldClass}
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-xs font-medium text-[var(--muted)]">
            Дедлайн до
          </label>
          <input
            type="date"
            name="deadlineBefore"
            defaultValue={initial.deadlineBefore}
            className={fieldClass}
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--text)] sm:min-h-0">
          <input
            type="checkbox"
            name="lowMargin"
            defaultChecked={initial.lowMargin}
            className="h-4 w-4 rounded border-[color:var(--border)]"
          />
          Низкая маржа (&lt; 50%)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:py-2"
        >
          {busy ? "…" : "Применить"}
        </button>
      </div>

      {allSkills.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium text-[var(--muted)]">Навыки исполнителя</p>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <input
                type="radio"
                name="skillsModeRadio"
                checked={skillsMode === "any"}
                onChange={() => setSkillsMode("any")}
              />
              хотя бы один
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
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
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  skills.has(s)
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "border border-[color:var(--border)] bg-[color:var(--muted-bg)] text-[var(--text)] hover:bg-[color:var(--elevate)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-[var(--muted)]">Статус заказа</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                status.has(s.value)
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "border border-[color:var(--border)] bg-[color:var(--muted-bg)] text-[var(--text)] hover:bg-[color:var(--elevate)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-[var(--muted)]">Риски</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RISK_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleRisk(r.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                risk.has(r.value)
                  ? "bg-amber-500/90 text-amber-950 dark:bg-amber-400/90 dark:text-zinc-950"
                  : "border border-amber-500/35 bg-[color:var(--muted-bg)] text-amber-950/90 hover:border-amber-500/55 dark:text-amber-100/90"
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
