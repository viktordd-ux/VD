import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
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
import { userStatusLabel } from "@/lib/ui-labels";
import { ExecutorSkillsEditor } from "../ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminExecutorDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user || user.role !== "executor") notFound();

  const [metrics, orders] = await Promise.all([
    getExecutorMetrics(user.id),
    prisma.order.findMany({
      where: { ...orderIsActive, executorId: user.id },
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
    }),
  ]);

  return (
    <div className="space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← К списку исполнителей
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {formatUserDisplayName(user)}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Рейтинг
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{metrics.score}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Просрочки (доля)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {metrics.overduePct.toFixed(1)}%
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Средняя скорость
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {metrics.avgDaysToComplete != null
              ? `${metrics.avgDaysToComplete.toFixed(1)} дн.`
              : "—"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Прибыль (завершённые)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-800">
            {metrics.totalProfit.toFixed(0)}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-900">Контакты и статус</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500">Телефон</dt>
            <dd className="mt-1 text-sm">{user.phone?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500">Telegram</dt>
            <dd className="mt-1 text-sm">{user.telegram?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500">Статус аккаунта</dt>
            <dd className="mt-1">
              <Badge tone={user.status === "active" ? "success" : "danger"}>
                {userStatusLabel[user.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-zinc-500">Профиль</dt>
            <dd className="mt-1">
              <Badge tone={user.onboarded ? "success" : "warning"}>
                {user.onboarded ? "Онбординг пройден" : "Нужен онбординг"}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-900">Навыки</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {user.primarySkill ? (
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900 ring-2 ring-blue-300">
              {user.primarySkill} — основной
            </span>
          ) : null}
          {user.skills
            .filter((s) => s !== user.primarySkill)
            .map((s) => (
              <span
                key={s}
                className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200"
              >
                {s}
              </span>
            ))}
        </div>
        <div className="mt-6 border-t border-zinc-100 pt-4">
          <p className="text-sm font-medium text-zinc-800">Изменить список навыков</p>
          <div className="mt-2">
            <ExecutorSkillsEditor user={user} embedded />
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Последние заказы</h2>
        <div className="mt-3">
          {orders.length === 0 ? (
            <p className="text-sm text-zinc-500">Заказов пока нет</p>
          ) : (
            <TableWrap>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/90">
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
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {o.title}
                        </Link>
                      </td>
                      <td className={tdClass}>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className={`${tdClass} tabular-nums text-zinc-600`}>
                        {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                      </td>
                      <td className={`${tdClass} tabular-nums`}>{o.profit.toString()}</td>
                      <td className={`${tdClass} text-xs text-zinc-500`}>
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
  );
}
