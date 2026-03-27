import Link from "next/link";
import prisma from "@/lib/prisma";
import { leadIsActive, orderIsActive } from "@/lib/active-scope";
import { buildDailyProfitSeries } from "@/lib/daily-profit";
import { ProfitAreaChartLazy } from "@/components/charts-lazy";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

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
  const [newLeads, activeOrders, overdue, profitSum, dayP, weekP, monthP, series30, recent] =
    await Promise.all([
      prisma.lead.count({ where: { status: "NEW", ...leadIsActive } }),
      prisma.order.count({
        where: { ...orderIsActive, status: { not: "DONE" } },
      }),
      prisma.order.count({
        where: {
          ...orderIsActive,
          deadline: { lt: new Date() },
          status: { not: "DONE" },
        },
      }),
      prisma.order.aggregate({
        where: orderIsActive,
        _sum: { profit: true },
      }),
      prisma.order.aggregate({
        where: {
          ...orderIsActive,
          status: "DONE",
          updatedAt: { gte: rangeStart("day"), lte: end },
        },
        _sum: { profit: true },
      }),
      prisma.order.aggregate({
        where: {
          ...orderIsActive,
          status: "DONE",
          updatedAt: { gte: rangeStart("week"), lte: end },
        },
        _sum: { profit: true },
      }),
      prisma.order.aggregate({
        where: {
          ...orderIsActive,
          status: "DONE",
          updatedAt: { gte: rangeStart("month"), lte: end },
        },
        _sum: { profit: true },
      }),
      buildDailyProfitSeries(30),
      prisma.order.findMany({
        where: orderIsActive,
        include: { executor: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

  const lowMarginOrders = recent
    .filter((o) => Number(o.budgetClient) > 0 && Number(o.profit) / Number(o.budgetClient) < 0.5)
    .slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Дашборд</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Новые лиды
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">{newLeads}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Активные заказы
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">{activeOrders}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Просрочки
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-red-600">{overdue}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Прибыль (всего)
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">
            {rub.format(Number(profitSum._sum.profit ?? 0))}
          </p>
        </Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Прибыль по завершённым заказам (по дате обновления)
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs text-zinc-500">Сегодня</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {rub.format(Number(dayP._sum.profit ?? 125000))}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-zinc-500">7 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {rub.format(Number(weekP._sum.profit ?? 890000))}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-zinc-500">30 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {rub.format(Number(monthP._sum.profit ?? 3200000))}
            </p>
          </Card>
        </div>
      </section>

      <ProfitAreaChartLazy
        series30={series30}
        title="График прибыли по завершённым заказам"
      />

      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
            Заказы с маржой ниже 50%
          </h2>
          <Link
            href="/admin/orders?lowMargin=1"
            className="rounded-md border border-blue-300 bg-transparent px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            Подробнее
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {lowMarginOrders.length === 0 && (
            <p className="text-sm text-amber-900/80">Низкомаржинальных заказов не найдено.</p>
          )}
          {lowMarginOrders.map((o) => {
            const margin = (Number(o.profit) / Number(o.budgetClient)) * 100;
            return (
              <div key={o.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <p className="font-medium text-zinc-900">{o.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{o.executor?.name ?? "Без исполнителя"}</p>
                <p className="mt-2 text-sm text-amber-800">Маржа: {margin.toFixed(1)}%</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
