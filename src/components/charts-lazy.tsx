"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";

function ChartSkeleton({ tall }: { tall?: boolean }) {
  return (
    <Card className="p-5">
      <div
        className={`w-full animate-pulse rounded-md bg-[color:var(--skeleton)] ${tall ? "h-80" : "h-64"}`}
      />
    </Card>
  );
}

/** Recharts + ResponsiveContainer часто падают при SSR на проде — грузим только на клиенте. */
export const ProfitAreaChartLazy = dynamic(
  () => import("@/components/profit-area-chart").then((m) => m.ProfitAreaChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const FinanceMarginBarChartLazy = dynamic(
  () => import("@/components/finance-margin-bar").then((m) => m.FinanceMarginBarChart),
  { ssr: false, loading: () => <ChartSkeleton tall /> },
);
