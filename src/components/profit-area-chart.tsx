"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; profit: number };

type Range = 1 | 7 | 30;

export function ProfitAreaChart({
  series30,
  title,
}: {
  series30: Point[];
  title?: string;
}) {
  const [range, setRange] = useState<Range>(30);

  const data = useMemo(() => {
    if (range === 30) return series30;
    if (range === 7) return series30.slice(-7);
    return series30.slice(-1);
  }, [range, series30]);

  const chartData = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <Card className="p-5">
      {title ? (
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-4 3 3 5-6" />
          </svg>
          {title}
        </h3>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {([1, 7, 30] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              range === r
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "border border-[color:var(--border)] text-[var(--muted)] hover:bg-[color:var(--muted-bg)] hover:text-[var(--text)]"
            }`}
          >
            {r === 1 ? "День" : r === 7 ? "7 дней" : "30 дней"}
          </button>
        ))}
      </div>
      <div className="mt-4 h-64 w-full min-w-0 [&_.recharts-cartesian-grid_line]:stroke-[color:var(--border)]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={48} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--vd-border)",
                borderRadius: "8px",
                color: "var(--text)",
              }}
              formatter={(v) => [
                typeof v === "number" ? v.toFixed(2) : String(v ?? ""),
                "Прибыль",
              ]}
              labelFormatter={(l) => `Дата ${l}`}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#a1a1aa"
              fill="#a1a1aa"
              fillOpacity={0.4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
