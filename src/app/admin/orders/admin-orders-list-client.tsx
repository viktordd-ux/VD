"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import { Card } from "@/components/ui/card";
import {
  getSupabaseBrowserClient,
  isSupabaseRealtimeConfigured,
} from "@/lib/supabase-client";
import {
  mergeOrderIntoListItem,
  parseCheckpointRowFromSupabase,
  parseFileRowFromSupabase,
  sortCheckpointsForUi,
} from "@/lib/supabase-realtime-parsers";
import { QuickCreateOrderButton } from "./quick-create-order";
import {
  type AdminOrderListViewSnapshot,
  type OrderListSort,
  type OrderWithRelations,
  marginRatio,
  matchesAdminOrderListView,
  sortOrders,
} from "@/lib/order-list-filters";
import {
  enrichOrderWithExecutorMap,
  formatExecutorMetricsLine,
  useExecutors,
} from "@/context/executors-context";
import {
  type SerializedOrderWithRelations,
  hydrateOrderWithRelations,
} from "@/lib/order-list-client-serialize";
import { OrderRowQuickActions } from "./order-row-actions";
import { OrdersBulkCheckbox } from "./orders-bulk";

type Props = {
  initialSerialized: SerializedOrderWithRelations[];
  viewSnapshot: AdminOrderListViewSnapshot;
  sort: OrderListSort;
  baseUrlParams: string;
  templates: { id: string; title: string }[];
};

export function AdminOrdersListClient({
  initialSerialized,
  viewSnapshot,
  sort,
  baseUrlParams,
  templates,
}: Props) {
  const router = useRouter();
  const { executorsMap, getExecutorDisplayName, getEntry } = useExecutors();
  const [orders, setOrders] = useState<OrderWithRelations[]>(() =>
    initialSerialized.map(hydrateOrderWithRelations),
  );
  const snapshotRef = useRef(viewSnapshot);
  const sortRef = useRef(sort);
  snapshotRef.current = viewSnapshot;
  sortRef.current = sort;

  useEffect(() => {
    setOrders(initialSerialized.map(hydrateOrderWithRelations));
  }, [initialSerialized]);

  const sortHref = useCallback(
    (nextSort: OrderListSort) => {
      const p = new URLSearchParams(baseUrlParams);
      p.set("sort", nextSort);
      return `/admin/orders?${p.toString()}`;
    },
    [baseUrlParams],
  );

  const applyOrdersPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const id = old?.id ? String(old.id) : null;
        if (!id) return;
        setOrders((prev) =>
          sortOrders(
            prev.filter((o) => o.id !== id),
            sortRef.current,
          ),
        );
        return;
      }
      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const id = String(row.id ?? "");
      if (!id) return;

      setOrders((prev) => {
        const prevItem = prev.find((o) => o.id === id);
        const merged = mergeOrderIntoListItem(row, prevItem);
        if (!merged) return prev;
        const snap = snapshotRef.current;
        const others = prev.filter((o) => o.id !== id);
        if (merged.deletedAt) {
          return sortOrders(others, sortRef.current);
        }
        if (!matchesAdminOrderListView(merged, snap)) {
          return sortOrders(others, sortRef.current);
        }
        return sortOrders([...others, merged], sortRef.current);
      });
    },
    [],
  );

  const applyCheckpointPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const orderIdRaw =
        (payload.new as Record<string, unknown> | null)?.order_id ??
        (payload.old as Record<string, unknown> | null)?.order_id;
      if (orderIdRaw == null) return;
      const orderId = String(orderIdRaw);

      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const cid = old?.id ? String(old.id) : null;
        if (!cid) return;
        setOrders((prev) => {
          if (!prev.some((o) => o.id === orderId)) return prev;
          return prev.map((o) => {
            if (o.id !== orderId) return o;
            return {
              ...o,
              checkpoints: o.checkpoints.filter((c) => c.id !== cid),
            };
          });
        });
        return;
      }

      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const c = parseCheckpointRowFromSupabase(row);
      if (!c) return;

      setOrders((prev) => {
        if (!prev.some((o) => o.id === orderId)) return prev;
        return prev.map((o) => {
          if (o.id !== orderId) return o;
          if (payload.eventType === "INSERT") {
            if (o.checkpoints.some((x) => x.id === c.id)) return o;
            const cleaned = o.checkpoints.filter(
              (x) =>
                !(
                  x.id.startsWith("optimistic-") &&
                  x.orderId === c.orderId &&
                  x.title === c.title
                ),
            );
            return {
              ...o,
              checkpoints: sortCheckpointsForUi([...cleaned, c]),
            };
          }
          const next = o.checkpoints.some((x) => x.id === c.id)
            ? o.checkpoints.map((x) => (x.id === c.id ? c : x))
            : [...o.checkpoints, c];
          return { ...o, checkpoints: sortCheckpointsForUi(next) };
        });
      });
    },
    [],
  );

  const applyFilePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const orderIdRaw =
        (payload.new as Record<string, unknown> | null)?.order_id ??
        (payload.old as Record<string, unknown> | null)?.order_id;
      if (orderIdRaw == null) return;
      const orderId = String(orderIdRaw);

      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const fid = old?.id ? String(old.id) : null;
        if (!fid) return;
        setOrders((prev) => {
          if (!prev.some((o) => o.id === orderId)) return prev;
          return prev.map((o) => {
            if (o.id !== orderId) return o;
            return { ...o, files: o.files.filter((f) => f.id !== fid) };
          });
        });
        return;
      }

      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const f = parseFileRowFromSupabase(row);
      if (!f) return;

      setOrders((prev) => {
        if (!prev.some((o) => o.id === orderId)) return prev;
        return prev.map((o) => {
          if (o.id !== orderId) return o;
          if (payload.eventType === "INSERT") {
            if (o.files.some((x) => x.id === f.id)) return o;
            return { ...o, files: [f, ...o.files] };
          }
          return {
            ...o,
            files: o.files.map((x) => (x.id === f.id ? f : x)),
          };
        });
      });
    },
    [],
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

  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isSupabaseRealtimeConfigured()) return;
    fallbackTimerRef.current = setInterval(
      () => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          return;
        }
        router.refresh();
      },
      120_000,
    );
    return () => {
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, [router]);

  const visible = useMemo(() => {
    return orders
      .map((o) => enrichOrderWithExecutorMap(o, executorsMap))
      .filter((o) => matchesAdminOrderListView(o, viewSnapshot));
  }, [orders, viewSnapshot, executorsMap]);

  return (
    <>
      {visible.length === 0 ? (
        <EmptyState
          title="Нет заказов по выбранным условиям"
          description="Измените фильтры или создайте новый заказ."
          action={
            <QuickCreateOrderButton templates={templates} label="Создать заказ" />
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/90">
                  <tr>
                    <th className={`${thClass} w-10`} aria-label="Выбор" />
                    <th className={thClass}>Название</th>
                    <th className={thClass}>Клиент</th>
                    <th className={thClass}>Статус</th>
                    <th className={thClass}>Исполнитель</th>
                    <th className={thClass}>
                      <Link
                        href={sortHref(sort === "deadline_asc" ? "deadline_desc" : "deadline_asc")}
                      >
                        Дедлайн
                      </Link>
                    </th>
                    <th className={thClass}>
                      <Link
                        href={sortHref(sort === "profit_desc" ? "profit_asc" : "profit_desc")}
                      >
                        Прибыль
                      </Link>
                    </th>
                    <th className={thClass}>
                      <Link
                        href={sortHref(sort === "margin_desc" ? "margin_asc" : "margin_desc")}
                      >
                        Маржа %
                      </Link>
                    </th>
                    <th className={thClass}>Обновлён</th>
                    <th className={`${thClass} w-[200px]`}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => {
                    const ex = o.executorId ? getEntry(o.executorId) : undefined;
                    return (
                    <tr key={o.id} className={trClass}>
                      <td className={`${tdClass} align-middle`}>
                        <OrdersBulkCheckbox orderId={o.id} />
                      </td>
                      <td className={tdClass}>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {o.title}
                        </Link>
                      </td>
                      <td className={tdClass}>{o.clientName}</td>
                      <td className={tdClass}>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className={tdClass}>
                        <div className="space-y-0.5">
                          <div>
                            {getExecutorDisplayName(o.executorId, o.executor?.name)}
                          </div>
                          {ex && (
                            <div className="text-xs tabular-nums text-zinc-500">
                              {formatExecutorMetricsLine(ex)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`${tdClass} tabular-nums text-zinc-600`}>
                        {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                      </td>
                      <td className={`${tdClass} tabular-nums`}>{o.profit.toString()}</td>
                      <td className={`${tdClass} tabular-nums text-zinc-700`}>
                        {(marginRatio(o) * 100).toFixed(1)}%
                      </td>
                      <td className={`${tdClass} tabular-nums text-xs text-zinc-500`}>
                        {o.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                      <td className={`${tdClass} align-top`}>
                        <OrderRowQuickActions
                          orderId={o.id}
                          status={o.status}
                          checkpointCount={o.checkpoints.length}
                        />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <div className="space-y-3 md:hidden">
            {visible.map((o) => {
              const ex = o.executorId ? getEntry(o.executorId) : undefined;
              return (
              <Card key={o.id} className="overflow-hidden p-4 shadow-sm">
                <div className="flex items-start gap-3 border-b border-zinc-100 pb-3">
                  <OrdersBulkCheckbox orderId={o.id} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-base font-semibold text-blue-600 hover:underline"
                    >
                      {o.title}
                    </Link>
                    <p className="mt-1 text-sm text-zinc-600">{o.clientName}</p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Исполнитель</dt>
                    <dd className="max-w-[60%] text-right">
                      <span className="font-medium text-zinc-900">
                        {getExecutorDisplayName(o.executorId, o.executor?.name)}
                      </span>
                      {ex && (
                        <span className="mt-0.5 block text-xs tabular-nums text-zinc-500">
                          {formatExecutorMetricsLine(ex)}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Дедлайн</dt>
                    <dd className="tabular-nums text-zinc-800">
                      {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Прибыль</dt>
                    <dd className="tabular-nums font-medium">{o.profit.toString()}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Маржа</dt>
                    <dd className="tabular-nums text-zinc-700">
                      {(marginRatio(o) * 100).toFixed(1)}%
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 text-xs">
                    <dt className="text-zinc-500">Обновлён</dt>
                    <dd className="tabular-nums text-zinc-500">
                      {o.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-zinc-100 pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Действия
                  </p>
                  <OrderRowQuickActions
                    orderId={o.id}
                    status={o.status}
                    checkpointCount={o.checkpoints.length}
                  />
                </div>
              </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
