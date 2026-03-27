"use client";

import { useMemo, useState } from "react";
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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {title ? (
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
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
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              range === r
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 text-zinc-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        По DONE-заказам с updatedAt в выбранном окне. Маржа % = Σприбыль / Σбюджет клиента.
      </p>
      <div className="mt-4 h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 11 }} unit="%" width={44} />
            <Tooltip
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
            <Bar dataKey="marginPct" fill="#6366f1" name="marginPct" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
