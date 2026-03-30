"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MarginBarPoint = { name: string; marginPct: number; profit: number };

export function FinanceMarginBarChart({
  series1,
  series7,
  series30,
  title,
}: {
  series1: MarginBarPoint[];
  series7: MarginBarPoint[];
  series30: MarginBarPoint[];
  title?: string;
}) {
  const [range, setRange] = useState<1 | 7 | 30>(30);

  const data = useMemo(() => {
    if (range === 30) return series30;
    if (range === 7) return series7;
    return series1;
  }, [range, series1, series7, series30]);

  return (
    <Card className="p-5">
      {title ? (
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M7 16v-4M12 16V8M17 16v-2" />
          </svg>
          {title}
        </h3>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {([
          { r: 1 as const, label: "1 день" },
          { r: 7 as const, label: "7 дней" },
          { r: 30 as const, label: "30 дней" },
        ]).map(({ r, label }) => (
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
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        По завершённым заказам с датой обновления в выбранном окне. Маржа % = сумма прибыли /
        сумма бюджета клиента.
      </p>
      <div className="mt-4 h-72 w-full min-w-0 [&_.recharts-cartesian-grid_line]:stroke-[color:var(--border)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" width={44} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--vd-border)",
                borderRadius: "8px",
                color: "var(--text)",
              }}
              formatter={(v, name) => {
                const n = typeof v === "number" ? v : Number(v);
                return [
                  name === "marginPct"
                    ? `${Number.isFinite(n) ? n.toFixed(1) : v}%`
                    : `${Number.isFinite(n) ? n.toFixed(2) : v}`,
                  name === "marginPct" ? "Маржа %" : "Прибыль",
                ];
              }}
            />
            <Bar dataKey="marginPct" fill="#a1a1aa" name="marginPct" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
