import Link from "next/link";
import prisma from "@/lib/prisma";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { CreateExecutorDialog } from "@/components/create-executor-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatUserDisplayName } from "@/lib/user-profile";
import { userStatusLabel } from "@/lib/ui-labels";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Исполнители</h1>
        <CreateExecutorDialog />
      </div>
      <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Рейтинг подбора: учёт просрочек по завершённым заказам, скорости и прибыли (шкала 0–100).
        Нажмите на строку, чтобы открыть карточку исполнителя.
      </p>

      <TableWrap>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/90">
            <tr>
              <th className={thClass}>Имя</th>
              <th className={thClass}>Основной навык</th>
              <th className={thClass}>Навыки</th>
              <th className={thClass}>Рейтинг</th>
              <th className={thClass}>Статус</th>
              <th className={thClass}>Профиль</th>
              <th className={thClass}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const score = metrics.get(u.id)?.score;
              return (
                <tr key={u.id} className={cn(trClass, "cursor-pointer hover:bg-zinc-100/80")}>
                  <td className={tdClass}>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {formatUserDisplayName(u)}
                    </Link>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </td>
                  <td className={tdClass}>
                    {u.primarySkill ? (
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-900 ring-1 ring-blue-200/80">
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
                    {score !== undefined ? (
                      <div className="min-w-[140px]">
                        <p className="text-xs font-semibold text-zinc-800">{score}</p>
                        <div className="mt-1 h-2 rounded-full bg-zinc-100">
                          <div
                            className="h-2 rounded-full bg-blue-600"
                            style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
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
                      className="inline-flex rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
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
  );
}
