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
  /** Последовательно: при connection_limit=1 (Supabase pooler + Vercel) Promise.all даёт P2024. */
  const newLeads = await prisma.lead.count({
    where: { status: "NEW", ...leadIsActive },
  });
  const activeOrders = await prisma.order.count({
    where: { ...orderIsActive, status: { not: "DONE" } },
  });
  const overdue = await prisma.order.count({
    where: {
      ...orderIsActive,
      deadline: { lt: new Date() },
      status: { not: "DONE" },
    },
  });
  const profitSum = await prisma.order.aggregate({
    where: orderIsActive,
    _sum: { profit: true },
  });
  const dayP = await prisma.order.aggregate({
    where: {
      ...orderIsActive,
      status: "DONE",
      updatedAt: { gte: rangeStart("day"), lte: end },
    },
    _sum: { profit: true },
  });
  const weekP = await prisma.order.aggregate({
    where: {
      ...orderIsActive,
      status: "DONE",
      updatedAt: { gte: rangeStart("week"), lte: end },
    },
    _sum: { profit: true },
  });
  const monthP = await prisma.order.aggregate({
    where: {
      ...orderIsActive,
      status: "DONE",
      updatedAt: { gte: rangeStart("month"), lte: end },
    },
    _sum: { profit: true },
  });
  const series30 = await buildDailyProfitSeries(30);
  const recent = await prisma.order.findMany({
    where: orderIsActive,
    include: { executor: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const lowMarginOrders = recent
    .filter((o) => Number(o.budgetClient) > 0 && Number(o.profit) / Number(o.budgetClient) < 0.5)
    .slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Дашборд</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Новые лиды
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text)]">{newLeads}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Активные заказы
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text)]">{activeOrders}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Просрочки
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-red-500 dark:text-red-400">
            {overdue}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Прибыль (всего)
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text)]">
            {rub.format(Number(profitSum._sum.profit ?? 0))}
          </p>
        </Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Прибыль по завершённым заказам (по дате обновления)
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs text-[var(--muted)]">Сегодня</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {rub.format(Number(dayP._sum.profit ?? 0))}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-[var(--muted)]">7 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {rub.format(Number(weekP._sum.profit ?? 0))}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-[var(--muted)]">30 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {rub.format(Number(monthP._sum.profit ?? 0))}
            </p>
          </Card>
        </div>
      </section>

      <ProfitAreaChartLazy
        series30={series30}
        title="График прибыли по завершённым заказам"
      />

      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/35">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100/95">
            Заказы с маржой ниже 50%
          </h2>
          <Link
            href="/admin/orders?lowMargin=1"
            className="rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--text)] shadow-sm transition-colors hover:bg-[color:var(--muted-bg)]"
          >
            Подробнее
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {lowMarginOrders.length === 0 && (
            <p className="text-sm text-amber-950/80 dark:text-amber-100/80">
              Низкомаржинальных заказов не найдено.
            </p>
          )}
          {lowMarginOrders.map((o) => {
            const margin = (Number(o.profit) / Number(o.budgetClient)) * 100;
            return (
              <div
                key={o.id}
                className="rounded-xl border border-amber-500/20 bg-[var(--card)] p-4 dark:border-amber-400/30"
              >
                <p className="font-medium text-[var(--text)]">{o.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {o.executor?.name ?? "Без исполнителя"}
                </p>
                <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                  Маржа: {margin.toFixed(1)}%
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
