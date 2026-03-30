"use client";

import type { OrderStatus } from "@prisma/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PrefetchOrderLink } from "@/components/prefetch-order-link";
import { OrderPriorityIndicator } from "@/components/order-priority-indicator";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusDot } from "@/components/order-status-dot";
import { useAdminOrdersListQuery } from "@/hooks/use-admin-orders-list-query";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  patchOrderInListCachesFromAdminApiJson,
  patchOrderStatusInListCaches,
  removeOrdersFromListCaches,
  removeSingleOrderFromListCaches,
  setOrderCheckpointsInListCaches,
  updateOrderCheckpointsInListCaches,
  updateOrderFilesInListCaches,
  upsertOrderInListCache,
} from "@/lib/react-query-realtime";
import { QuickCreateOrderButton } from "./quick-create-order";
import {
  type OrderListSort,
  type OrderWithRelations,
  marginRatio,
  matchesAdminOrderListView,
} from "@/lib/order-list-filters";
import {
  enrichOrderWithExecutorMap,
  formatExecutorMetricsLine,
  useExecutors,
} from "@/context/executors-context";
import { hydrateOrderWithRelations } from "@/lib/order-list-client-serialize";
import { OrderRowQuickActions } from "./order-row-actions";
import { OrdersBulkCheckbox } from "./orders-bulk";
import type { OrderUnreadBatchRow } from "@/lib/order-unread-service";
import {
  AdminOrdersListActionsProvider,
  type AdminOrdersListActions,
} from "@/context/admin-orders-list-actions";
import { orderStatusLabel } from "@/lib/ui-labels";
import { computeOrderPriority } from "@/lib/order-priority";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

type OrderUnreadRow = Omit<OrderUnreadBatchRow, "orderId">;

function orderUnreadTooltip(f: OrderUnreadRow): string {
  if (f.hasUnreadChat && f.hasUnreadProject) {
    return "Новые сообщения и обновления по этому заказу";
  }
  if (f.hasUnreadChat) return "Новые сообщения в чате по этому заказу";
  return "Есть обновления по этому заказу";
}

function deadlineShort(o: OrderWithRelations): string {
  if (!o.deadline) return "без срока";
  return o.deadline.toISOString().slice(0, 10);
}

type Props = {
  spString: string;
  baseUrlParams: string;
  templates: { id: string; title: string }[];
  children?: React.ReactNode;
};

export function AdminOrdersListClient({
  spString,
  baseUrlParams,
  templates,
  children,
}: Props) {
  const queryClient = useQueryClient();
  const { data } = useAdminOrdersListQuery(spString);
  const { executorsMap, getExecutorDisplayName, getEntry } = useExecutors();

  const sortHref = useCallback(
    (nextSort: OrderListSort) => {
      const p = new URLSearchParams(baseUrlParams);
      p.set("sort", nextSort);
      return `/admin/orders?${p.toString()}`;
    },
    [baseUrlParams],
  );

  const listActions = useMemo<AdminOrdersListActions>(() => {
    return {
      patchOrderFromAdminApi: (orderId, json) => {
        patchOrderInListCachesFromAdminApiJson(queryClient, orderId, json);
      },
      removeOrder: (orderId) => {
        removeSingleOrderFromListCaches(queryClient, orderId);
      },
      removeOrders: (ids) => {
        removeOrdersFromListCaches(queryClient, ids);
      },
      setOrderCheckpoints: (orderId, checkpoints) => {
        setOrderCheckpointsInListCaches(queryClient, orderId, checkpoints);
      },
      patchOrderStatus: (orderId, status) => {
        patchOrderStatusInListCaches(
          queryClient,
          orderId,
          status as OrderStatus,
        );
      },
    };
  }, [queryClient]);

  const applyOrdersPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      upsertOrderInListCache(queryClient, payload);
    },
    [queryClient],
  );

  const applyCheckpointPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      updateOrderCheckpointsInListCaches(queryClient, payload);
    },
    [queryClient],
  );

  const applyFilePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      updateOrderFilesInListCaches(queryClient, payload);
    },
    [queryClient],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("admin-orders-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        applyOrdersPayload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checkpoints",
        },
        applyCheckpointPayload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "files",
        },
        applyFilePayload,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [applyOrdersPayload, applyCheckpointPayload, applyFilePayload]);

  const searchParams = useSearchParams();
  const priorityFilter = searchParams.get("priority");

  const viewSnapshot = data?.viewSnapshot;
  const sort = data?.sort;

  const orders = useMemo(
    () => (data?.orders ?? []).map(hydrateOrderWithRelations),
    [data?.orders],
  );

  const visible = useMemo(() => {
    if (!viewSnapshot) return [];
    let list = orders
      .map((o) => enrichOrderWithExecutorMap(o, executorsMap))
      .filter((o) => matchesAdminOrderListView(o, viewSnapshot));
    if (
      priorityFilter === "high" ||
      priorityFilter === "medium" ||
      priorityFilter === "low"
    ) {
      list = list.filter(
        (o) => computeOrderPriority(o, o.checkpoints) === priorityFilter,
      );
    }
    return list;
  }, [orders, viewSnapshot, executorsMap, priorityFilter]);

  const visibleIdsKey = useMemo(
    () =>
      visible
        .map((o) => o.id)
        .sort()
        .join(","),
    [visible],
  );

  const [unreadByOrderId, setUnreadByOrderId] = useState<Record<string, OrderUnreadRow>>({});

  const fetchUnreadForVisible = useCallback(async () => {
    const ids = visibleIdsKey ? visibleIdsKey.split(",").filter(Boolean) : [];
    if (ids.length === 0) {
      setUnreadByOrderId({});
      return;
    }
    try {
      const res = await fetch("/api/orders/unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids }),
      });
      if (!res.ok) return;
      const payload = (await res.json()) as { orders?: OrderUnreadBatchRow[] };
      const next: Record<string, OrderUnreadRow> = {};
      for (const row of payload.orders ?? []) {
        next[row.orderId] = {
          hasUnreadChat: row.hasUnreadChat,
          hasUnreadProject: row.hasUnreadProject,
          hasUnreadAny: row.hasUnreadAny,
        };
      }
      setUnreadByOrderId(next);
    } catch {
      // сеть
    }
  }, [visibleIdsKey]);

  useEffect(() => {
    void fetchUnreadForVisible();
  }, [fetchUnreadForVisible]);

  useEffect(() => {
    const id = setInterval(() => void fetchUnreadForVisible(), 30_000);
    return () => clearInterval(id);
  }, [fetchUnreadForVisible]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") void fetchUnreadForVisible();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchUnreadForVisible]);

  useEffect(() => {
    function onUnreadChanged() {
      void fetchUnreadForVisible();
    }
    window.addEventListener("vd:order-unread-changed", onUnreadChanged);
    return () => window.removeEventListener("vd:order-unread-changed", onUnreadChanged);
  }, [fetchUnreadForVisible]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "vd:admin-order-ids",
        JSON.stringify(visible.map((o) => o.id)),
      );
    } catch {
      /* ignore */
    }
  }, [visible]);

  if (!data || sort == null) {
    return null;
  }

  const sortGroups: (
    | {
        label: string;
        asc: OrderListSort;
        desc: OrderListSort;
      }
    | { label: string; only: OrderListSort }
  )[] = [
    {
      label: "Дедлайн",
      asc: "deadline_asc",
      desc: "deadline_desc",
    },
    {
      label: "Прибыль",
      asc: "profit_asc",
      desc: "profit_desc",
    },
    {
      label: "Маржа",
      asc: "margin_asc",
      desc: "margin_desc",
    },
    { label: "Обновлено", only: "updated_desc" },
  ];

  return (
    <AdminOrdersListActionsProvider value={listActions}>
      {children}
      {visible.length === 0 ? (
        <EmptyState
          title="Нет заказов по выбранным условиям"
          description="Измените фильтры или создайте новый заказ."
          action={
            <QuickCreateOrderButton templates={templates} label="Создать заказ" />
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-zinc-500 md:text-xs">
            <span className="mr-1 text-zinc-400">Сортировка</span>
            {sortGroups.map((g, i) => {
              if ("only" in g) {
                const isOn = sort === g.only;
                return (
                  <span key={g.label} className="inline-flex items-center">
                    {i > 0 ? (
                      <span className="mx-1 text-zinc-300" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    <Link
                      href={sortHref(g.only)}
                      className={cn(
                        "cursor-pointer rounded-md px-1.5 py-0.5 transition-all duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.98]",
                        isOn && "font-medium text-zinc-900",
                      )}
                    >
                      {g.label}
                    </Link>
                  </span>
                );
              }
              const isGroup = sort === g.asc || sort === g.desc;
              const next =
                sort === g.asc ? g.desc : sort === g.desc ? g.asc : g.desc;
              return (
                <span key={g.label} className="inline-flex items-center">
                  {i > 0 ? (
                    <span className="mx-1 text-zinc-300" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  <Link
                    href={sortHref(next)}
                    className={cn(
                      "cursor-pointer rounded-md px-1.5 py-0.5 transition-all duration-150 ease-out hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.98]",
                      isGroup && "font-medium text-zinc-900",
                    )}
                  >
                    {g.label}
                    {isGroup ? (sort === g.asc ? " ↑" : " ↓") : ""}
                  </Link>
                </span>
              );
            })}
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-sm shadow-black/[0.04] dark:shadow-black/40">
            <div className="divide-y divide-[color:var(--border)]">
              {visible.map((o) => {
                const ex = o.executorId ? getEntry(o.executorId) : undefined;
                const executorName = getExecutorDisplayName(
                  o.executorId,
                  o.executor?.name,
                );
                const marginPct = (marginRatio(o) * 100).toFixed(1);
                const updatedShort = o.updatedAt
                  .toISOString()
                  .slice(0, 16)
                  .replace("T", " ");
                const priority = computeOrderPriority(o, o.checkpoints);

                return (
                  <div
                    key={o.id}
                    className="group relative flex min-h-[3.5rem] origin-center items-stretch will-change-transform transition-all duration-200 ease-out first:rounded-t-xl last:rounded-b-xl hover:z-[1] hover:bg-[color:var(--muted-bg)] hover:shadow-[0_1px_0_rgba(15,23,42,0.06)] active:scale-[0.99] dark:hover:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    <div
                      className="flex shrink-0 items-center pl-2 pr-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <OrdersBulkCheckbox orderId={o.id} />
                    </div>

                    <PrefetchOrderLink
                      orderId={o.id}
                      href={`/admin/orders/${o.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-1 pr-2 outline-none transition-[background-color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-300/80 md:gap-4 md:pr-3"
                    >
                      <span className="mt-1 flex shrink-0 flex-col items-center gap-1 self-start">
                        <OrderStatusDot
                          status={o.status}
                          title={orderStatusLabel[o.status]}
                        />
                        <OrderPriorityIndicator level={priority} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start gap-3">
                          {o.executorId ? (
                            <Avatar
                              size="sm"
                              name={executorName}
                              seed={o.executorId}
                              className="mt-0.5 shrink-0"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          {unreadByOrderId[o.id]?.hasUnreadAny ? (
                            <span
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                              title={orderUnreadTooltip(unreadByOrderId[o.id]!)}
                              aria-label={orderUnreadTooltip(unreadByOrderId[o.id]!)}
                            />
                          ) : null}
                          <span className="truncate text-[15px] font-semibold leading-snug tracking-tight text-[var(--text)]">
                            {o.title}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs leading-relaxed text-[var(--muted)]">
                          {o.clientName}
                          <span className="text-[color:var(--border)]"> · </span>
                          {executorName}
                          {ex ? (
                            <>
                              <span className="text-[color:var(--border)]"> · </span>
                              <span className="tabular-nums text-[var(--muted)]">
                                {formatExecutorMetricsLine(ex)}
                              </span>
                            </>
                          ) : null}
                          <span className="text-[color:var(--border)]"> · </span>
                          <span className="tabular-nums">{deadlineShort(o)}</span>
                        </p>
                          </div>
                        </div>
                      </div>

                      <div className="hidden shrink-0 flex-col items-end justify-center gap-0.5 text-right sm:flex">
                        <span className="text-xs font-medium tabular-nums text-zinc-900">
                          {o.profit.toString()}
                        </span>
                        <span className="text-[11px] tabular-nums text-zinc-500">
                          {marginPct}%
                        </span>
                        <span className="max-w-[7rem] truncate text-[11px] text-zinc-400">
                          {orderStatusLabel[o.status]}
                        </span>
                      </div>

                      <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 text-right sm:hidden">
                        <span className="text-xs font-semibold tabular-nums text-zinc-900">
                          {o.profit.toString()}
                        </span>
                        <span className="text-[10px] tabular-nums text-zinc-400">
                          {updatedShort}
                        </span>
                      </div>
                    </PrefetchOrderLink>

                    <div
                      className="flex shrink-0 items-center pr-1 opacity-100 transition-opacity md:pr-2 md:opacity-0 md:group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <OrderRowQuickActions
                        orderId={o.id}
                        status={o.status}
                        checkpointCount={o.checkpoints.length}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AdminOrdersListActionsProvider>
  );
}
