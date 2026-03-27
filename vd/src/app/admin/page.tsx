import Link from "next/link";
import prisma from "@/lib/prisma";
import { buildDailyProfitSeries } from "@/lib/daily-profit";
import { ProfitAreaChart } from "@/components/profit-area-chart";

export const dynamic = "force-dynamic";

function rangeStart(period: "day" | "week" | "month"): Date {
  const end = new Date();
  const start = new Date(end);
  if (period === "day") start.setHours(0, 0, 0, 0);
  else if (period === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return start;
}

export default async function AdminDashboard() {
  const end = new Date();
  const [newLeads, activeOrders, overdue, profitSum, dayP, weekP, monthP, series30] =
    await Promise.all([
      prisma.lead.count({ where: { status: "NEW" } }),
      prisma.order.count({ where: { status: { not: "DONE" } } }),
      prisma.order.count({
        where: {
          deadline: { lt: new Date() },
          status: { not: "DONE" },
        },
      }),
      prisma.order.aggregate({ _sum: { profit: true } }),
      prisma.order.aggregate({
        where: {
          status: "DONE",
          updatedAt: { gte: rangeStart("day"), lte: end },
        },
        _sum: { profit: true },
      }),
      prisma.order.aggregate({
        where: {
          status: "DONE",
          updatedAt: { gte: rangeStart("week"), lte: end },
        },
        _sum: { profit: true },
      }),
      prisma.order.aggregate({
        where: {
          status: "DONE",
          updatedAt: { gte: rangeStart("month"), lte: end },
        },
        _sum: { profit: true },
      }),
      buildDailyProfitSeries(30),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Новые лиды</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{newLeads}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Активные заказы</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{activeOrders}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Просрочки</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-red-600">
            {overdue}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Прибыль (всего)</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {profitSum._sum.profit?.toString() ?? "0"}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase text-zinc-500">
          Прибыль по завершённым заказам (по дате обновления)
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Сегодня</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {dayP._sum.profit?.toString() ?? "0"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">7 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {weekP._sum.profit?.toString() ?? "0"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">30 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {monthP._sum.profit?.toString() ?? "0"}
            </p>
          </div>
        </div>
      </div>

      <ProfitAreaChart series30={series30} title="График прибыли (DONE)" />

      <p>
        <Link
          href="/admin/orders?lowMargin=1"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Заказы с маржой &lt; 50%
        </Link>
      </p>
    </div>
  );
}
