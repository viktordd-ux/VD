"use client";

import { OrderRiskBadges } from "@/components/order-risk-badges";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Card } from "@/components/ui/card";
import { getOrderRiskFlags } from "@/lib/order-risk";
import {
  formatExecutorMetricsLine,
  useExecutors,
} from "@/context/executors-context";
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
    <Card className="p-4 shadow-md shadow-slate-950/[0.06] md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 md:text-2xl">
            {order.title}
          </h1>
          <OrderRiskBadges flags={riskFlags} />
        </div>
        <div className="shrink-0 self-start">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>
      <dl className="mt-6 space-y-4 border-t border-zinc-100 pt-6 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
        <div className="order-1 sm:order-none">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Исполнитель
          </dt>
          <dd className="mt-1 text-base font-medium leading-relaxed text-zinc-900 md:text-sm">
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
              "Не назначен"
            )}
          </dd>
        </div>
        <div className="order-2 sm:order-none">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Дедлайн
          </dt>
          <dd className="mt-1 text-base tabular-nums leading-relaxed text-zinc-900 md:text-sm">
            {deadlineLabel}
          </dd>
        </div>
        <div className="order-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 sm:order-none sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Финансы
          </dt>
          <dd className="mt-2">
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-baseline sm:gap-8">
              <div>
                <span className="text-zinc-500">Маржа: </span>
                <span className="font-semibold tabular-nums text-emerald-800">
                  {marginPct !== null ? `${marginPct}%` : "—"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Прибыль: </span>
                <span className="font-semibold tabular-nums text-zinc-900">
                  {order.profit.toString()}
                </span>
              </div>
            </div>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
