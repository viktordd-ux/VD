"use client";

import { OrderRiskBadges } from "@/components/order-risk-badges";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  formatExecutorMetricsLine,
  useExecutors,
} from "@/context/executors-context";
import { OrderPriorityIndicator } from "@/components/order-priority-indicator";
import { getOrderRiskFlags } from "@/lib/order-risk";
import { computeOrderPriority } from "@/lib/order-priority";
import { useAdminOrder } from "./admin-order-context";

export function AdminOrderSummaryCard() {
  const { getExecutorDisplayName, getEntry } = useExecutors();
  const { order, checkpoints, files } = useAdminOrder();
  const executorEntry = order.executorId ? getEntry(order.executorId) : undefined;
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

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-10">
      <div className="min-w-0 space-y-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl md:leading-tight">
            {order.title}
          </h1>
          <OrderRiskBadges flags={riskFlags} />
        </div>
      </div>

      <aside className="rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm shadow-zinc-950/[0.03] lg:sticky lg:top-24">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Статус
          </span>
          <div className="flex items-center gap-2">
            <OrderPriorityIndicator level={priority} showLabel />
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Исполнитель
            </dt>
            <dd className="mt-1.5 text-sm font-medium leading-snug text-zinc-900">
              {order.executorId ? (
                <>
                  <span>
                    {getExecutorDisplayName(order.executorId, order.executor?.name)}
                  </span>
                  {executorEntry && (
                    <span className="mt-1 block text-xs font-normal tabular-nums text-zinc-500">
                      {formatExecutorMetricsLine(executorEntry)}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-normal text-zinc-500">Не назначен</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Дедлайн
            </dt>
            <dd className="mt-1.5 text-sm tabular-nums text-zinc-900">
              {deadlineLabel}
            </dd>
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Финансы
            </dt>
            <dd className="mt-2">
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-baseline sm:gap-8">
                <div>
                  <span className="text-zinc-500">Маржа </span>
                  <span className="font-semibold tabular-nums text-emerald-800">
                    {marginPct !== null ? `${marginPct}%` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Прибыль </span>
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {order.profit.toString()}
                  </span>
                </div>
              </div>
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
