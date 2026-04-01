"use client";

import { OrderRiskBadges } from "@/components/order-risk-badges";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  formatExecutorMetricsLine,
  useExecutors,
} from "@/context/executors-context";
import { Avatar } from "@/components/ui/avatar";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { OrderPriorityIndicator } from "@/components/order-priority-indicator";
import { getOrderRiskFlags } from "@/lib/order-risk";
import { computeOrderPriority } from "@/lib/order-priority";
import type { OrderWithRelations } from "@/lib/order-client-deserialize";
import { getOrderParticipantUserIds } from "@/lib/order-participants";
import { useAdminOrder } from "./admin-order-context";

function participantDisplayName(
  order: OrderWithRelations,
  userId: string,
  getExecutorDisplayName: (id: string, name?: string) => string,
  getEntry: (id: string) => { name: string } | undefined,
) {
  const m = order.team?.members?.find((x) => x.userId === userId);
  return getExecutorDisplayName(
    userId,
    getEntry(userId)?.name ?? m?.user?.name,
  );
}

export function AdminOrderSummaryCard({
  layout = "split",
}: {
  /** split: заголовок слева + сайдбар справа; для страницы заказа — headerOnly + sidebarOnly в сетке. */
  layout?: "split" | "headerOnly" | "sidebarOnly";
}) {
  const { getExecutorDisplayName, getEntry } = useExecutors();
  const { order, checkpoints, files } = useAdminOrder();
  const participantIds = getOrderParticipantUserIds(order);
  const riskFlags = getOrderRiskFlags(order, checkpoints, files);

  const marginPct =
    Number(order.budgetClient) > 0
      ? Math.round((Number(order.profit) / Number(order.budgetClient)) * 100)
      : null;

  const priority = computeOrderPriority(order, checkpoints);

  const deadlineLabel = order.deadline
    ? order.deadline.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Не задан";

  const header = (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] md:text-3xl md:leading-tight">
            {order.title}
          </h1>
          <OrderRiskBadges flags={riskFlags} />
        </div>
        {participantIds.length > 0 ? (
          <AvatarStack size="md" className="shrink-0 sm:pt-1">
            {participantIds.map((id) => (
              <Avatar
                key={id}
                name={participantDisplayName(
                  order,
                  id,
                  getExecutorDisplayName,
                  getEntry,
                )}
                seed={id}
                size="md"
                ringClassName="ring-2 ring-[var(--card)]"
              />
            ))}
          </AvatarStack>
        ) : null}
      </div>
    </div>
  );

  const sidebar = (
      <aside className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-5 shadow-sm shadow-[var(--elevate)] dark:shadow-black/40">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] pb-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Статус
          </span>
          <div className="flex items-center gap-2">
            <OrderPriorityIndicator level={priority} showLabel />
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Участники
            </dt>
            {order.team?.name ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{order.team.name}</p>
            ) : null}
            <dd className="mt-1.5 text-sm font-medium leading-snug text-[var(--text)]">
              {participantIds.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <AvatarStack size="md" className="shrink-0 pt-0.5">
                    {participantIds.map((id) => (
                      <Avatar
                        key={id}
                        name={participantDisplayName(
                          order,
                          id,
                          getExecutorDisplayName,
                          getEntry,
                        )}
                        seed={id}
                        size="md"
                        ringClassName="ring-2 ring-[var(--card)]"
                      />
                    ))}
                  </AvatarStack>
                  <div className="min-w-0 space-y-2">
                    {participantIds.map((id) => {
                      const entry = getEntry(id);
                      const label = participantDisplayName(
                        order,
                        id,
                        getExecutorDisplayName,
                        getEntry,
                      );
                      return (
                        <div key={id}>
                          <p className="font-medium leading-snug">{label}</p>
                          {entry && (
                            <p className="mt-0.5 text-xs font-normal tabular-nums text-[var(--muted)]">
                              {formatExecutorMetricsLine(entry)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <span className="font-normal text-[var(--muted)]">Не назначены</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Дедлайн
            </dt>
            <dd className="mt-1.5 text-sm tabular-nums text-[var(--text)]">
              {deadlineLabel}
            </dd>
          </div>

          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted-bg)] p-4">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Финансы
            </dt>
            <dd className="mt-2">
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-baseline sm:gap-8">
                <div>
                  <span className="text-[var(--muted)]">Маржа </span>
                  <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {marginPct !== null ? `${marginPct}%` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted)]">Прибыль </span>
                  <span className="font-semibold tabular-nums text-[var(--text)]">
                    {order.profit.toString()}
                  </span>
                </div>
              </div>
            </dd>
          </div>
        </dl>
      </aside>
  );

  if (layout === "headerOnly") return header;
  if (layout === "sidebarOnly") return sidebar;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-10">
      {header}
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">{sidebar}</div>
    </div>
  );
}
