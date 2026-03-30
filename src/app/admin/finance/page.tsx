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
import { AdminFinanceTable } from "@/components/admin-finance-table";
import { FinanceFilters } from "./finance-filters";

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

  const allOrders = await prisma.order.findMany({
    where: { ...orderIsActive, ...execWhere },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      clientName: true,
      budgetClient: true,
      budgetExecutor: true,
      profit: true,
    },
    take: 200,
  });

  /** Последовательно: избегаем P2024 при connection_limit=1 на Vercel + Supabase pooler. */
  const totals = await prisma.order.aggregate({
    where: orderIsActive,
    _sum: {
      budgetClient: true,
      budgetExecutor: true,
      profit: true,
    },
    _count: true,
  });
  const dayP = await prisma.order.aggregate({
    where: {
      ...orderIsActive,
      status: "DONE",
      updatedAt: { gte: rangeStart("day"), lte: end },
      ...execWhere,
    },
    _sum: { profit: true },
  });
  const weekP = await prisma.order.aggregate({
    where: {
      ...orderIsActive,
      status: "DONE",
      updatedAt: { gte: rangeStart("week"), lte: end },
      ...execWhere,
    },
    _sum: { profit: true },
  });
  const monthP = await prisma.order.aggregate({
    where: {
      ...orderIsActive,
      status: "DONE",
      updatedAt: { gte: rangeStart("month"), lte: end },
      ...execWhere,
    },
    _sum: { profit: true },
  });
  const series30profit = await buildDailyProfitSeries(30);
  const doneOrders = await prisma.order.findMany({
    where: orderWhereDone,
    select: {
      profit: true,
      budgetClient: true,
      executorId: true,
    },
  });
  const users = await prisma.user.findMany({
    where: { role: "executor" },
    select: { id: true, name: true },
  });

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
    <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
          <IconWallet />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Финансы</h1>
      </div>

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
        <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-6 shadow-sm dark:shadow-black/30">
          <p className="flex items-center gap-2 text-xs font-medium uppercase text-[var(--muted)]">
            <IconClient /> Клиент (всего)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {rub.format(Number(totals._sum.budgetClient ?? 0))}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-6 shadow-sm dark:shadow-black/30">
          <p className="flex items-center gap-2 text-xs font-medium uppercase text-[var(--muted)]">
            <IconExecutor /> Исполнители (всего)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {rub.format(Number(totals._sum.budgetExecutor ?? 0))}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-6 shadow-sm dark:shadow-black/30">
          <p className="flex items-center gap-2 text-xs font-medium uppercase text-[var(--muted)]">
            <IconProfit /> Маржа (всего)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {rub.format(Number(totals._sum.profit ?? 0))}
          </p>
        </div>
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <IconClock />
          Прибыль по завершённым (по дате обновления, без фильтров страницы)
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4 shadow-sm dark:shadow-black/30">
            <p className="text-xs text-[var(--muted)]">День</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {rub.format(Number(dayP._sum.profit ?? 0))}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4 shadow-sm dark:shadow-black/30">
            <p className="text-xs text-[var(--muted)]">Неделя</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {rub.format(Number(weekP._sum.profit ?? 0))}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4 shadow-sm dark:shadow-black/30">
            <p className="text-xs text-[var(--muted)]">Месяц</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {rub.format(Number(monthP._sum.profit ?? 0))}
            </p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          <IconExecutor />
          По исполнителям (с учётом фильтров выше)
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-sm dark:shadow-black/30">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-[color:var(--border)] bg-[color:var(--muted-bg)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Исполнитель</th>
                <th className="px-4 py-3">Сумма клиента</th>
                <th className="px-4 py-3">Прибыль</th>
                <th className="px-4 py-3">Маржа %</th>
              </tr>
            </thead>
            <tbody>
              {executorRows.map((row) => (
                <tr key={row.id} className="border-b border-[color:var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{row.name}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text)]">
                    {row.budgetClient.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text)]">
                    {rub.format(row.profit)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text)]">
                    {row.marginPct !== null ? `${row.marginPct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {executorRows.length === 0 && (
            <p className="p-4 text-sm text-[var(--muted)]">Нет данных по фильтрам.</p>
          )}
        </div>
      </section>

      <p className="text-sm text-[var(--muted)]">
        Заказов в базе: {totals._count}.{" "}
        <Link
          href="/admin/orders?lowMargin=1"
          className="font-medium text-[var(--text)] underline-offset-2 hover:underline"
        >
          Низкая маржа
        </Link>{" "}
        в списке заказов.
      </p>

      <section>
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            <IconEdit />
            Редактирование финансов по заказам
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Нажмите «Изменить» для корректировки бюджетов (возвраты, скидки). Прибыль
            пересчитывается автоматически. Изменения записываются в историю аудита.
          </p>
        </div>
        <AdminFinanceTable
          orders={allOrders.map((o) => ({
            id: o.id,
            title: o.title,
            status: o.status,
            clientName: o.clientName,
            budgetClient: o.budgetClient.toString(),
            budgetExecutor: o.budgetExecutor.toString(),
            profit: o.profit.toString(),
          }))}
        />
      </section>
    </div>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M16 12h4" />
      <circle cx="16" cy="12" r="1" />
    </svg>
  );
}

function IconClient() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function IconExecutor() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M20 8v6M17 11h6" />
    </svg>
  );
}

function IconProfit() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
