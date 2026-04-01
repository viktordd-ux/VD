import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
import { getExecutorMetrics } from "@/lib/executor-matching";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import { formatUserDisplayName } from "@/lib/user-profile";
import { AdminDeleteExecutor } from "@/components/admin-delete-executor";
import {
  ExecutorAccountStatusRow,
  ExecutorDetailHeaderStatusBadge,
  ExecutorDetailStatusProvider,
} from "./executor-detail-status-context";
import { ExecutorSkillsSection } from "../executor-skills-section";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminExecutorDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") {
    redirect(session.user.role === "executor" ? "/executor" : "/login");
  }
  const orgIds = await getAccessibleOrganizationIds(session.user.id);
  const orgScope =
    orgIds.length === 0
      ? { id: { in: [] as string[] } }
      : { organizationId: { in: orgIds } };

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user || user.role !== "executor") notFound();

  const metrics = await getExecutorMetrics(user.id, orgIds);
  const orders = await prisma.order.findMany({
    where: { ...orderIsActive, ...orgScope, executorId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 25,
    select: {
      id: true,
      title: true,
      status: true,
      deadline: true,
      updatedAt: true,
      profit: true,
    },
  });

  const initials = formatUserDisplayName(user)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <ExecutorDetailStatusProvider initialStatus={user.status}>
    <div className="space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
      >
        ← К списку исполнителей
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--text)] text-sm font-semibold text-[var(--bg)]">
              {initials || "EX"}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
                {formatUserDisplayName(user)}
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExecutorDetailHeaderStatusBadge />
            <Badge tone="neutral">{user.onboarded ? "Профиль заполнен" : "Профиль не заполнен"}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Рейтинг
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            ⭐ {metrics.rating.toFixed(0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Просрочки (доля)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {metrics.latePercent.toFixed(1)}%
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Завершено заказов
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {metrics.completedOrders}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Средний срок (часы)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {metrics.avgResponseTime != null
              ? `${metrics.avgResponseTime.toFixed(1)} ч`
              : "—"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Прибыль (завершённые)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">
            {metrics.totalProfit.toFixed(0)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[var(--text)]">Контакты</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--border)] bg-[var(--bg)] p-3">
              <dt className="text-xs font-medium uppercase text-[var(--muted)]">Телефон</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--text)]">{user.phone?.trim() || "—"}</dd>
            </div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[var(--bg)] p-3">
              <dt className="text-xs font-medium uppercase text-[var(--muted)]">Telegram</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--text)]">{user.telegram?.trim() || "—"}</dd>
            </div>
            <div className="rounded-xl border border-[color:var(--border)] bg-[var(--bg)] p-3 sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-[var(--muted)]">
                Telegram ID (уведомления бота)
              </dt>
              <dd className="mt-1 font-mono text-sm font-medium text-[var(--text)]">
                {user.telegramId?.trim() || "—"}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[var(--text)]">Управление аккаунтом</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge tone="neutral">{user.onboarded ? "Онбординг пройден" : "Нужен онбординг"}</Badge>
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <ExecutorAccountStatusRow userId={user.id} />
            </div>
            <AdminDeleteExecutor
              userId={user.id}
              displayName={formatUserDisplayName(user)}
            />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-[var(--text)]">Навыки</h2>
        <ExecutorSkillsSection user={user} />
      </Card>

      <section>
        <h2 className="text-base font-semibold text-[var(--text)]">Последние заказы</h2>
        <div className="mt-3">
          {orders.length === 0 ? (
            <Card className="border-dashed border-[color:var(--border)] bg-[color:var(--muted-bg)] py-10 text-center shadow-none">
              <p className="text-sm font-medium text-[var(--text)]">Заказов пока нет</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                После назначения исполнителя на заказ здесь появится история работ.
              </p>
            </Card>
          ) : (
            <TableWrap>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[color:var(--border)] bg-[color:var(--muted-bg)]">
                  <tr>
                    <th className={thClass}>Название</th>
                    <th className={thClass}>Статус</th>
                    <th className={thClass}>Дедлайн</th>
                    <th className={thClass}>Прибыль</th>
                    <th className={thClass}>Обновлён</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className={trClass}>
                      <td className={tdClass}>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium text-[var(--text)] hover:underline"
                        >
                          {o.title}
                        </Link>
                      </td>
                      <td className={tdClass}>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className={`${tdClass} tabular-nums text-[var(--muted)]`}>
                        {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                      </td>
                      <td className={`${tdClass} tabular-nums`}>{o.profit.toString()}</td>
                      <td className={`${tdClass} text-xs text-[var(--muted)]`}>
                        {o.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </section>
    </div>
    </ExecutorDetailStatusProvider>
  );
}
