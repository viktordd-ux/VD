"use client";

import { useMemo, useState } from "react";
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {title ? (
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {([1, 7, 30] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              range === r
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 text-zinc-700"
            }`}
          >
            {r === 1 ? "День" : r === 7 ? "7 дней" : "30 дней"}
          </button>
        ))}
      </div>
      <div className="mt-4 h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-zinc-500" />
            <YAxis tick={{ fontSize: 11 }} className="text-zinc-500" width={48} />
            <Tooltip
              formatter={(v) => [
                typeof v === "number" ? v.toFixed(2) : String(v ?? ""),
                "Прибыль",
              ]}
              labelFormatter={(l) => `Дата ${l}`}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#18181b"
              fill="#a1a1aa"
              fillOpacity={0.35}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
