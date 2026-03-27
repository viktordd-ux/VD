import Link from "next/link";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { buildDailyProfitSeries } from "@/lib/daily-profit";
import { buildMarginSeriesByExecutor } from "@/lib/finance-margin-series";
import {
  FinanceMarginBarChartLazy,
  ProfitAreaChartLazy,
} from "@/components/charts-lazy";
import { FinanceFilters } from "./finance-filters";

export const dynamic = "force-dynamic";

function rangeStart(period: "day" | "week" | "month"): Date {
  const end = new Date();
  const start = new Date(end);
  if (period === "day") start.setHours(0, 0, 0, 0);
  else if (period === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return start;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const dateFromStr = sp.dateFrom?.trim();
  const dateToStr = sp.dateTo?.trim();
  const executorId = sp.executorId?.trim();
  const lowMargin = sp.lowMargin === "1";

  const dateFrom = dateFromStr
    ? new Date(`${dateFromStr}T00:00:00.000Z`)
    : undefined;
  const dateTo = dateToStr
    ? new Date(`${dateToStr}T23:59:59.999Z`)
    : undefined;

  const end = new Date();

  const execWhere = executorId ? { executorId } : {};

  const { series1, series7, series30 } = await buildMarginSeriesByExecutor({
    executorId,
    lowMargin,
    dateFrom,
    dateTo,
  });

  const orderWhereDone: Prisma.OrderWhereInput = {
    ...orderIsActive,
    status: "DONE",
    ...execWhere,
    ...(dateFrom || dateTo
      ? {
          updatedAt: {
            gte: dateFrom ?? new Date(0),
            lte: dateTo ?? end,
          },
        }
      : {}),
  };

  const [totals, dayP, weekP, monthP, series30profit, doneOrders, users] =
    await Promise.all([
      prisma.order.aggregate({
        where: orderIsActive,
        _sum: {
          budgetClient: true,
          budgetExecutor: true,
          profit: true,
        },
        _count: true,
      }),
      prisma.order.aggregate({
        where: {
          ...orderIsActive,
          status: "DONE",
          updatedAt: { gte: rangeStart("day"), lte: end },
          ...execWhere,
        },
        _sum: { profit: true },
      }),
      prisma.order.aggregate({
        where: {
          ...orderIsActive,
          status: "DONE",
          updatedAt: { gte: rangeStart("week"), lte: end },
          ...execWhere,
        },
        _sum: { profit: true },
      }),
      prisma.order.aggregate({
        where: {
          ...orderIsActive,
          status: "DONE",
          updatedAt: { gte: rangeStart("month"), lte: end },
          ...execWhere,
        },
        _sum: { profit: true },
      }),
      buildDailyProfitSeries(30),
      prisma.order.findMany({
        where: orderWhereDone,
        select: {
          profit: true,
          budgetClient: true,
          executorId: true,
        },
      }),
      prisma.user.findMany({
        where: { role: "executor" },
        select: { id: true, name: true },
      }),
    ]);

  let filteredDone = doneOrders;
  if (lowMargin) {
    filteredDone = filteredDone.filter((o) => {
      const bc = Number(o.budgetClient);
      return bc > 0 && Number(o.profit) / bc < 0.5;
    });
  }

  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const byExec = new Map<
    string,
    { profit: number; budgetClient: number }
  >();
  for (const o of filteredDone) {
    if (!o.executorId) continue;
    const id = o.executorId;
    const cur = byExec.get(id) ?? { profit: 0, budgetClient: 0 };
    cur.profit += Number(o.profit);
    cur.budgetClient += Number(o.budgetClient);
    byExec.set(id, cur);
  }

  const executorRows = [...byExec.entries()]
    .map(([id, v]) => {
      const marginPct =
        v.budgetClient > 0 ? (v.profit / v.budgetClient) * 100 : null;
      return {
        id,
        name: nameById.get(id) ?? id,
        profit: v.profit,
        budgetClient: v.budgetClient,
        marginPct,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  const filterInitial = {
    dateFrom: dateFromStr ?? "",
    dateTo: dateToStr ?? "",
    executorId: executorId ?? "",
    lowMargin,
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Финансы</h1>

      <FinanceFilters
        key={JSON.stringify(filterInitial)}
        executors={users.map((u) => ({ id: u.id, name: u.name }))}
        initial={filterInitial}
      />

      <FinanceMarginBarChartLazy
        series1={series1}
        series7={series7}
        series30={series30}
        title="Маржа % по исполнителям (завершённые заказы)"
      />

      <ProfitAreaChartLazy
        series30={series30profit}
        title="Прибыль по завершённым заказам по дням"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Клиент (всего)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {totals._sum.budgetClient?.toString() ?? "0"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Исполнители (всего)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {totals._sum.budgetExecutor?.toString() ?? "0"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-zinc-500">Маржа (всего)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
            {totals._sum.profit?.toString() ?? "0"}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Прибыль по завершённым (по дате обновления, без фильтров страницы)
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">День</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {dayP._sum.profit?.toString() ?? "0"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Неделя</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {weekP._sum.profit?.toString() ?? "0"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Месяц</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {monthP._sum.profit?.toString() ?? "0"}
            </p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          По исполнителям (с учётом фильтров выше)
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Исполнитель</th>
                <th className="px-4 py-3">Сумма клиента</th>
                <th className="px-4 py-3">Прибыль</th>
                <th className="px-4 py-3">Маржа %</th>
              </tr>
            </thead>
            <tbody>
              {executorRows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.budgetClient.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-emerald-800">
                    {row.profit.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.marginPct !== null ? `${row.marginPct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {executorRows.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">Нет данных по фильтрам.</p>
          )}
        </div>
      </section>

      <p className="text-sm text-zinc-500">
        Заказов в базе: {totals._count}.{" "}
        <Link
          href="/admin/orders?lowMargin=1"
          className="font-medium text-blue-600 hover:underline"
        >
          Низкая маржа
        </Link>{" "}
        в списке заказов.
      </p>
    </div>
  );
}
