"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AdminDbUnavailableBanner } from "@/components/admin-db-unavailable-banner";
import { CreateExecutorDialog } from "@/components/create-executor-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatUserDisplayName } from "@/lib/user-profile";
import { userStatusLabel } from "@/lib/ui-labels";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";

/** Совпадает с ответом GET /api/users (enriched). */
export type AdminExecutorListRow = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "active" | "banned";
  primarySkill: string | null;
  skills: string[];
  onboarded: boolean;
  rating: number;
  completedOrders: number;
  latePercent: number;
  avgResponseTime: number | null;
};

export function AdminUsersListClient({
  initialRows,
  loadError,
}: {
  initialRows: AdminExecutorListRow[];
  /** Ошибка загрузки с сервера (БД) — список может быть пустым */
  loadError?: string | null;
}) {
  const [rows, setRows] = useState(initialRows);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/users");
    if (!res.ok) return;
    const data = (await res.json()) as AdminExecutorListRow[];
    setRows(data);
  }, []);

  return (
    <div className="space-y-6">
      {loadError ? <AdminDbUnavailableBanner message={loadError} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Исполнители</h1>
        <div className="w-full sm:w-auto [&_button]:w-full [&_button]:sm:w-auto">
          <CreateExecutorDialog onCreated={refresh} />
        </div>
      </div>
      <p className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-4 py-3 text-sm text-[var(--text)]">
        Рейтинг считается по завершённым заказам: пунктуальность, объём, скорость и вклад (шкала 0–100).
        Нажмите на строку, чтобы открыть карточку исполнителя.
      </p>

      <div className="hidden md:block">
        <TableWrap>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-[color:var(--border)] bg-[color:var(--muted-bg)]">
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
              {rows.map((u) => {
                const rating = u.rating;
                return (
                  <tr
                    key={u.id}
                    className={cn(trClass, "cursor-pointer hover:bg-[color:var(--muted-bg)]")}
                  >
                    <td className={tdClass}>
                      <div className="flex items-center gap-3">
                        <Avatar
                          size="sm"
                          name={formatUserDisplayName(u)}
                          seed={u.id}
                          className="shrink-0"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="font-semibold text-[var(--text)] hover:underline"
                          >
                            {formatUserDisplayName(u)}
                          </Link>
                          <p className="text-xs text-[var(--muted)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tdClass}>
                      {u.primarySkill ? (
                        <span className="inline-flex rounded-full bg-[color:var(--muted-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text)] ring-1 ring-[color:var(--border)]">
                          {u.primarySkill}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${tdClass} max-w-[240px]`}>
                      <span className="line-clamp-2 text-[var(--muted)]">
                        {u.skills.length ? u.skills.join(", ") : "—"}
                      </span>
                    </td>
                    <td className={`${tdClass} tabular-nums`}>
                      <div className="min-w-[120px]">
                        <p className="text-xs font-semibold text-[var(--text)]">
                          ⭐ {rating.toFixed(0)}
                        </p>
                        <div className="mt-1 h-2 rounded-full bg-[color:var(--muted-bg)]">
                          <div
                            className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-100"
                            style={{ width: `${Math.max(5, Math.min(100, rating))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className={`${tdClass} tabular-nums text-[var(--text)]`}>
                      {u.completedOrders}
                    </td>
                    <td className={`${tdClass} tabular-nums text-[var(--text)]`}>
                      {`${u.latePercent.toFixed(0)}%`}
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
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--text)] shadow-sm transition-colors hover:bg-[color:var(--muted-bg)] sm:min-h-0 sm:py-1.5"
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
        {rows.map((u) => {
          const rating = u.rating;
          return (
            <Card key={u.id} className="p-4 shadow-sm">
              <div className="flex gap-3 border-b border-[color:var(--border)] pb-4">
                <Avatar
                  size="md"
                  name={formatUserDisplayName(u)}
                  seed={u.id}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/users/${u.id}`}
                  className="text-base font-semibold text-[var(--text)] hover:underline"
                >
                  {formatUserDisplayName(u)}
                </Link>
                <p className="break-all text-sm text-[var(--muted)]">{u.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={u.status === "active" ? "success" : "danger"}>
                    {userStatusLabel[u.status]}
                  </Badge>
                  <Badge tone={u.onboarded ? "success" : "warning"}>
                    {u.onboarded ? "Профиль заполнен" : "Онбординг"}
                  </Badge>
                </div>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium text-[var(--muted)]">Основной навык</dt>
                  <dd className="mt-0.5">
                    {u.primarySkill ? (
                      <span className="inline-flex rounded-full bg-[color:var(--muted-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text)] ring-1 ring-[color:var(--border)]">
                        {u.primarySkill}
                      </span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--muted)]">Навыки</dt>
                  <dd className="mt-0.5 leading-relaxed text-[var(--muted)]">
                    {u.skills.length ? u.skills.join(", ") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--muted)]">Рейтинг</dt>
                  <dd className="mt-1">
                    <p className="text-sm font-semibold tabular-nums text-[var(--text)]">
                      ⭐ {rating.toFixed(0)}
                    </p>
                    <div className="mt-1 h-2 rounded-full bg-[color:var(--muted-bg)]">
                      <div
                        className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-100"
                        style={{ width: `${Math.max(5, Math.min(100, rating))}%` }}
                      />
                    </div>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs font-medium text-[var(--muted)]">Завершено заказов</dt>
                  <dd className="tabular-nums text-[var(--text)]">{u.completedOrders}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-xs font-medium text-[var(--muted)]">Просрочки</dt>
                  <dd className="tabular-nums text-[var(--text)]">{`${u.latePercent.toFixed(0)}%`}</dd>
                </div>
              </dl>
              <Link
                href={`/admin/users/${u.id}`}
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-4 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[color:var(--elevate)]"
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
