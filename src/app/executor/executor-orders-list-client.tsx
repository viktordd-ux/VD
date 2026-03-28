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
import { mergeOrderIntoListItem } from "@/lib/supabase-realtime-parsers";
import {
  type OrderWithRelations,
  matchesExecutorHomeOrder,
  sortOrders,
} from "@/lib/order-list-filters";
import {
  type SerializedOrderWithRelations,
  hydrateOrderWithRelations,
} from "@/lib/order-list-client-serialize";
import type { OrderUnreadBatchRow } from "@/lib/order-unread-service";

type OrderUnreadRow = Omit<OrderUnreadBatchRow, "orderId">;

type Props = {
  initialSerialized: SerializedOrderWithRelations[];
  userId: string;
};

export function ExecutorOrdersListClient({ initialSerialized, userId }: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithRelations[]>(() =>
    initialSerialized.map(hydrateOrderWithRelations),
  );
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    setOrders(initialSerialized.map(hydrateOrderWithRelations));
  }, [initialSerialized]);

  const applyOrdersPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const uid = userIdRef.current;
      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const id = old?.id ? String(old.id) : null;
        if (!id) return;
        setOrders((prev) =>
          sortOrders(
            prev.filter((o) => o.id !== id),
            "deadline_asc",
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
        const others = prev.filter((o) => o.id !== id);
        if (merged.deletedAt || merged.executorId !== uid) {
          return sortOrders(others, "deadline_asc");
        }
        if (!matchesExecutorHomeOrder(merged)) {
          return sortOrders(others, "deadline_asc");
        }
        return sortOrders([...others, merged], "deadline_asc");
      });
    },
    [],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`executor-orders-list-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        applyOrdersPayload,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, applyOrdersPayload]);

  useEffect(() => {
    if (isSupabaseRealtimeConfigured()) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      router.refresh();
    }, 120_000);
    return () => clearInterval(id);
  }, [router]);

  const visible = useMemo(
    () => orders.filter((o) => matchesExecutorHomeOrder(o)),
    [orders],
  );

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
      const data = (await res.json()) as { orders?: OrderUnreadBatchRow[] };
      const next: Record<string, OrderUnreadRow> = {};
      for (const row of data.orders ?? []) {
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

  function orderUnreadTooltip(f: OrderUnreadRow): string {
    if (f.hasUnreadChat && f.hasUnreadProject) {
      return "Новые сообщения и обновления по этому заказу";
    }
    if (f.hasUnreadChat) return "Новые сообщения в чате по этому заказу";
    return "Есть обновления по этому заказу";
  }

  return (
    <>
      {visible.length === 0 ? (
        <EmptyState
          title="Активных задач нет"
          description="Когда администратор назначит вам заказ, он появится в этом списке."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/90">
                  <tr>
                    <th className={thClass}>Название</th>
                    <th className={thClass}>Статус</th>
                    <th className={thClass}>Дедлайн</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr key={o.id} className={trClass}>
                      <td className={tdClass}>
                        <div className="flex min-w-0 items-center gap-2">
                          {unreadByOrderId[o.id]?.hasUnreadAny ? (
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500"
                              title={orderUnreadTooltip(unreadByOrderId[o.id]!)}
                              aria-label={orderUnreadTooltip(unreadByOrderId[o.id]!)}
                            />
                          ) : null}
                          <Link
                            href={`/executor/orders/${o.id}`}
                            className="min-w-0 font-medium text-blue-600 hover:underline"
                          >
                            {o.title}
                          </Link>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className={`${tdClass} tabular-nums`}>
                        {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <div className="space-y-3 md:hidden">
            {visible.map((o) => (
              <Card key={o.id} className="p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-zinc-100 pb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {unreadByOrderId[o.id]?.hasUnreadAny ? (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500"
                        title={orderUnreadTooltip(unreadByOrderId[o.id]!)}
                        aria-label={orderUnreadTooltip(unreadByOrderId[o.id]!)}
                      />
                    ) : null}
                    <Link
                      href={`/executor/orders/${o.id}`}
                      className="min-w-0 text-base font-semibold text-blue-600 hover:underline"
                    >
                      {o.title}
                    </Link>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
                <dl className="mt-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <dt className="text-zinc-500">Дедлайн</dt>
                    <dd className="tabular-nums font-medium text-zinc-900">
                      {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/executor/orders/${o.id}`}
                  className="mt-4 flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Открыть заказ
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
