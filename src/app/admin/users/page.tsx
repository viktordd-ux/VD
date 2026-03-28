import Link from "next/link";
import prisma from "@/lib/prisma";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { CreateExecutorDialog } from "@/components/create-executor-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatUserDisplayName } from "@/lib/user-profile";
import { userStatusLabel } from "@/lib/ui-labels";
import { Card } from "@/components/ui/card";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { role: "executor" },
    orderBy: { name: "asc" },
  });
  const metrics = await getExecutorMetricsMap(users.map((u) => u.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Исполнители</h1>
        <div className="w-full sm:w-auto [&_button]:w-full [&_button]:sm:w-auto">
          <CreateExecutorDialog />
        </div>
      </div>
      <p className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-800">
        Рейтинг считается по завершённым заказам: пунктуальность, объём, скорость и вклад (шкала 0–100).
        Нажмите на строку, чтобы открыть карточку исполнителя.
      </p>

      <div className="hidden md:block">
        <TableWrap>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/90">
              <tr>
                <th className={thClass}>Имя</th>
                <th className={thClass}>Основной навык</th>
                <th className={thClass}>Навыки</th>
                <th className={thClass}>Рейтинг</th>
                <th className={thClass}>Завершено</th>
                <th className={thClass}>Просрочки</th>
                <th className={thClass}>Статус</th>
                <th className={thClass}>Профиль</th>
                <th className={thClass}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const m = metrics.get(u.id);
                const rating = m?.rating ?? 0;
                return (
                  <tr key={u.id} className={cn(trClass, "cursor-pointer hover:bg-zinc-100/80")}>
                    <td className={tdClass}>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {formatUserDisplayName(u)}
                      </Link>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </td>
                    <td className={tdClass}>
                      {u.primarySkill ? (
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200">
                          {u.primarySkill}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${tdClass} max-w-[240px]`}>
                      <span className="line-clamp-2 text-zinc-700">
                        {u.skills.length ? u.skills.join(", ") : "—"}
                      </span>
                    </td>
                    <td className={`${tdClass} tabular-nums`}>
                      <div className="min-w-[120px]">
                        <p className="text-xs font-semibold text-zinc-800">
                          ⭐ {rating.toFixed(0)}
                        </p>
                        <div className="mt-1 h-2 rounded-full bg-zinc-100">
                          <div
                            className="h-2 rounded-full bg-zinc-900"
                            style={{ width: `${Math.max(5, Math.min(100, rating))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className={`${tdClass} tabular-nums`}>
                      {m?.completedOrders ?? 0}
                    </td>
                    <td className={`${tdClass} tabular-nums`}>
                      {m ? `${m.latePercent.toFixed(0)}%` : "—"}
                    </td>
                    <td className={tdClass}>
                      <Badge tone={u.status === "active" ? "success" : "danger"}>
                        {userStatusLabel[u.status]}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <Badge tone={u.onboarded ? "success" : "warning"}>
                        {u.onboarded ? "Заполнен" : "Онбординг"}
                      </Badge>
                    </td>
                    <td className={tdClass}>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 sm:min-h-0 sm:py-1.5"
                      >
                        Подробнее
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>

      <div className="space-y-3 md:hidden">
        {users.map((u) => {
          const m = metrics.get(u.id);
          const rating = m?.rating ?? 0;
          return (
            <Card key={u.id} className="p-4 shadow-sm">
              <div className="flex flex-col gap-2 border-b border-zinc-100 pb-3">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="text-base font-semibold text-zinc-900 hover:underline"
                >
                  {formatUserDisplayName(u)}
                </Link>
                <p className="break-all text-sm text-zinc-500">{u.email}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={u.status === "active" ? "success" : "danger"}>
                    {userStatusLabel[u.status]}
                  </Badge>
                  <Badge tone={u.onboarded ? "success" : "warning"}>
                    {u.onboarded ? "Профиль заполнен" : "Онбординг"}
                  </Badge>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Основной навык</dt>
                  <dd className="mt-0.5">
                    {u.primarySkill ? (
                      <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200">
                        {u.primarySkill}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Навыки</dt>
                  <dd className="mt-0.5 leading-relaxed text-zinc-800">
                    {u.skills.length ? u.skills.join(", ") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-zinc-500">Рейтинг</dt>
                  <dd className="mt-1">
                    <p className="text-sm font-semibold tabular-nums text-zinc-800">
                      ⭐ {rating.toFixed(0)}
                    </p>
                    <div className="mt-1 h-2 rounded-full bg-zinc-100">
                      <div
                        className="h-2 rounded-full bg-zinc-900"
                        style={{ width: `${Math.max(5, Math.min(100, rating))}%` }}
                      />
                    </div>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs font-medium text-zinc-500">Завершено заказов</dt>
                  <dd className="tabular-nums text-zinc-800">{m?.completedOrders ?? 0}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs font-medium text-zinc-500">Просрочки</dt>
                  <dd className="tabular-nums text-zinc-800">
                    {m ? `${m.latePercent.toFixed(0)}%` : "—"}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/admin/users/${u.id}`}
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Подробнее
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
