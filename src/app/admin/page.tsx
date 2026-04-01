import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminDbUnavailableBanner } from "@/components/admin-db-unavailable-banner";
import { loadAdminDashboardData } from "./admin-dashboard-data";
import { ProfitAreaChartLazy } from "@/components/charts-lazy";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function formatRub(n: number): string {
  try {
    return rub.format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${Math.round(Number.isFinite(n) ? n : 0)} ₽`;
  }
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") {
    redirect(session.user.role === "executor" ? "/executor" : "/login");
  }

  const result = await loadAdminDashboardData(session.user.id);

  if (!result.ok) {
    return (
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Дашборд</h1>
        <AdminDbUnavailableBanner message={result.message} />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/orders"
            className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--bg)] transition hover:opacity-90"
          >
            Перейти к заказам
          </Link>
        </div>
      </div>
    );
  }

  const {
    newLeads,
    activeOrders,
    overdue,
    profitSum,
    dayProfit,
    weekProfit,
    monthProfit,
    series30,
    recent,
  } = result.data;

  const lowMarginOrders = recent
    .filter(
      (o) => Number(o.budgetClient) > 0 && Number(o.profit) / Number(o.budgetClient) < 0.5,
    )
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
          <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text)]">
            {activeOrders}
          </p>
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
            {formatRub(profitSum)}
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
              {formatRub(dayProfit)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-[var(--muted)]">7 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {formatRub(weekProfit)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-[var(--muted)]">30 дней</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--text)]">
              {formatRub(monthProfit)}
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
