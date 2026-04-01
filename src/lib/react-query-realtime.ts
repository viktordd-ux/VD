import type { Checkpoint, File, OrderStatus } from "@prisma/client";
import type { QueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { mergeListOrderFromAdminApiJson } from "@/lib/order-list-api-merge";
import {
  hydrateOrderWithRelations,
  serializeOrdersForListClient,
} from "@/lib/order-list-client-serialize";
import {
  type AdminOrderListViewSnapshot,
  type OrderListSort,
  type OrderWithRelations,
  matchesAdminOrderListView,
  sortOrders,
} from "@/lib/order-list-filters";
import { queryKeys } from "@/lib/query-keys";
import {
  mergeOrderIntoListItem,
  parseCheckpointRowFromSupabase,
  parseFileRowFromSupabase,
  parseOrderRowFromSupabase,
  sortCheckpointsForUi,
} from "@/lib/supabase-realtime-parsers";
import type { User } from "@prisma/client";
import {
  normalizeOrderForClient,
  type OrderWithRelations as AdminDetailOrder,
} from "@/lib/order-client-deserialize";

import type { SerializedOrderWithRelations } from "@/lib/order-list-client-serialize";

/** Данные GET /api/admin/orders-list в кэше React Query. */
export type AdminOrdersListQueryPayload = {
  orders: SerializedOrderWithRelations[];
  allSkills: string[];
  templates: { id: string; title: string }[];
  teams: { id: string; name: string }[];
  viewSnapshot: AdminOrderListViewSnapshot;
  sort: OrderListSort;
  baseUrlParams: string;
  /** true — БД недоступна, отдан пустой список без 500 */
  degraded?: boolean;
  degradedMessage?: string;
};

const ADMIN_ORDERS_PREFIX = ["admin", "orders"] as const;

function patchAllAdminOrderLists(
  queryClient: QueryClient,
  updater: (payload: AdminOrdersListQueryPayload) => AdminOrdersListQueryPayload,
) {
  queryClient.setQueriesData<AdminOrdersListQueryPayload>(
    { queryKey: ADMIN_ORDERS_PREFIX },
    (old) => (old ? updater(old) : old),
  );
}

/** INSERT / UPDATE по таблице orders → все кэшированные списки админа. */
export function upsertOrderInListCache(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  if (payload.eventType === "DELETE") {
    removeOrderFromListCache(queryClient, payload);
    return;
  }
  const row = payload.new as Record<string, unknown> | null;
  if (!row) return;
  const id = String(row.id ?? "");
  if (!id) return;

  patchAllAdminOrderLists(queryClient, (old) => {
    const orders = old.orders.map(hydrateOrderWithRelations);
    const prevItem = orders.find((o) => o.id === id);
    const merged = mergeOrderIntoListItem(row, prevItem);
    if (!merged) return old;
    const snap = old.viewSnapshot;
    const sort = old.sort;
    const others = orders.filter((o) => o.id !== id);
    if (merged.deletedAt) {
      return {
        ...old,
        orders: serializeOrdersForListClient(sortOrders(others, sort)),
      };
    }
    if (!matchesAdminOrderListView(merged, snap)) {
      return {
        ...old,
        orders: serializeOrdersForListClient(sortOrders(others, sort)),
      };
    }
    return {
      ...old,
      orders: serializeOrdersForListClient(
        sortOrders([...others, merged], sort),
      ),
    };
  });
}

/** DELETE по таблице orders. */
export function removeOrderFromListCache(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  const old = payload.old as Record<string, unknown> | null;
  const id = old?.id ? String(old.id) : null;
  if (!id) return;
  patchAllAdminOrderLists(queryClient, (data) => {
    const orders = data.orders.map(hydrateOrderWithRelations);
    return {
      ...data,
      orders: serializeOrdersForListClient(
        sortOrders(
          orders.filter((o) => o.id !== id),
          data.sort,
        ),
      ),
    };
  });
}

export const removeOrderFromCache = removeOrderFromListCache;

/** События checkpoints → строки списка (чекпоинты на заказе). */
export function updateOrderCheckpointsInListCaches(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  const orderIdRaw =
    (payload.new as Record<string, unknown> | null)?.order_id ??
    (payload.old as Record<string, unknown> | null)?.order_id;
  if (orderIdRaw == null) return;
  const orderId = String(orderIdRaw);

  if (payload.eventType === "DELETE") {
    const old = payload.old as Record<string, unknown> | null;
    const cid = old?.id ? String(old.id) : null;
    if (!cid) return;
    patchAllAdminOrderLists(queryClient, (data) => {
      const orders = data.orders.map(hydrateOrderWithRelations);
      if (!orders.some((o) => o.id === orderId)) return data;
      const next = orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          checkpoints: o.checkpoints.filter((c) => c.id !== cid),
        };
      });
      return {
        ...data,
        orders: serializeOrdersForListClient(
          sortOrders(next, data.sort),
        ),
      };
    });
    return;
  }

  const row = payload.new as Record<string, unknown> | null;
  if (!row) return;
  const c = parseCheckpointRowFromSupabase(row);
  if (!c) return;

  patchAllAdminOrderLists(queryClient, (data) => {
    const orders = data.orders.map(hydrateOrderWithRelations);
    if (!orders.some((o) => o.id === orderId)) return data;
    const next = orders.map((o) => {
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
      const cpNext = o.checkpoints.some((x) => x.id === c.id)
        ? o.checkpoints.map((x) => (x.id === c.id ? c : x))
        : [...o.checkpoints, c];
      return { ...o, checkpoints: sortCheckpointsForUi(cpNext) };
    });
    return {
      ...data,
      orders: serializeOrdersForListClient(sortOrders(next, data.sort)),
    };
  });
}

/** События files → строки списка. */
export function updateOrderFilesInListCaches(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  const orderIdRaw =
    (payload.new as Record<string, unknown> | null)?.order_id ??
    (payload.old as Record<string, unknown> | null)?.order_id;
  if (orderIdRaw == null) return;
  const orderId = String(orderIdRaw);

  if (payload.eventType === "DELETE") {
    const old = payload.old as Record<string, unknown> | null;
    const fid = old?.id ? String(old.id) : null;
    if (!fid) return;
    patchAllAdminOrderLists(queryClient, (data) => {
      const orders = data.orders.map(hydrateOrderWithRelations);
      if (!orders.some((o) => o.id === orderId)) return data;
      const next = orders.map((o) => {
        if (o.id !== orderId) return o;
        return { ...o, files: o.files.filter((f) => f.id !== fid) };
      });
      return {
        ...data,
        orders: serializeOrdersForListClient(sortOrders(next, data.sort)),
      };
    });
    return;
  }

  const row = payload.new as Record<string, unknown> | null;
  if (!row) return;
  const f = parseFileRowFromSupabase(row);
  if (!f) return;

  patchAllAdminOrderLists(queryClient, (data) => {
    const orders = data.orders.map(hydrateOrderWithRelations);
    if (!orders.some((o) => o.id === orderId)) return data;
    const next = orders.map((o) => {
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
    return {
      ...data,
      orders: serializeOrdersForListClient(sortOrders(next, data.sort)),
    };
  });
}

export const updateOrderCheckpoints = updateOrderCheckpointsInListCaches;
export const updateOrderFiles = updateOrderFilesInListCaches;

export function patchOrderInListCachesFromAdminApiJson(
  queryClient: QueryClient,
  orderId: string,
  json: Record<string, unknown>,
) {
  patchAllAdminOrderLists(queryClient, (old) => {
    const orders = old.orders.map(hydrateOrderWithRelations);
    const item = orders.find((o) => o.id === orderId);
    if (!item) return old;
    const merged = mergeListOrderFromAdminApiJson(item, json);
    const others = orders.filter((o) => o.id !== orderId);
    const snap = old.viewSnapshot;
    if (!matchesAdminOrderListView(merged, snap)) {
      return {
        ...old,
        orders: serializeOrdersForListClient(sortOrders(others, old.sort)),
      };
    }
    return {
      ...old,
      orders: serializeOrdersForListClient(
        sortOrders([...others, merged], old.sort),
      ),
    };
  });
}

/** Алиас (PATCH админки → поля строки списка). */
export const updateOrderFieldInListCaches = patchOrderInListCachesFromAdminApiJson;

export function removeOrdersFromListCaches(queryClient: QueryClient, ids: string[]) {
  const rm = new Set(ids);
  patchAllAdminOrderLists(queryClient, (old) => {
    const orders = old.orders.map(hydrateOrderWithRelations);
    return {
      ...old,
      orders: serializeOrdersForListClient(
        sortOrders(
          orders.filter((o) => !rm.has(o.id)),
          old.sort,
        ),
      ),
    };
  });
}

export function removeSingleOrderFromListCaches(
  queryClient: QueryClient,
  orderId: string,
) {
  removeOrdersFromListCaches(queryClient, [orderId]);
}

export function patchOrderStatusInListCaches(
  queryClient: QueryClient,
  orderId: string,
  status: OrderStatus,
) {
  patchAllAdminOrderLists(queryClient, (old) => {
    const orders = old.orders.map(hydrateOrderWithRelations);
    const item = orders.find((o) => o.id === orderId);
    if (!item) return old;
    const merged = { ...item, status };
    const others = orders.filter((o) => o.id !== orderId);
    const snap = old.viewSnapshot;
    if (!matchesAdminOrderListView(merged, snap)) {
      return {
        ...old,
        orders: serializeOrdersForListClient(sortOrders(others, old.sort)),
      };
    }
    return {
      ...old,
      orders: serializeOrdersForListClient(
        sortOrders([...others, merged], old.sort),
      ),
    };
  });
}

export function setOrderCheckpointsInListCaches(
  queryClient: QueryClient,
  orderId: string,
  checkpoints: Checkpoint[],
) {
  patchAllAdminOrderLists(queryClient, (old) => {
    const orders = old.orders.map(hydrateOrderWithRelations);
    const next = orders.map((o) =>
      o.id === orderId
        ? { ...o, checkpoints: sortCheckpointsForUi(checkpoints) }
        : o,
    );
    return {
      ...old,
      orders: serializeOrdersForListClient(sortOrders(next, old.sort)),
    };
  });
}

// --- Admin order detail bundle (["admin","order", id]) ---

export type AdminOrderBundleCached = {
  order: AdminDetailOrder;
  checkpoints: Checkpoint[];
  files: File[];
  executors: Pick<User, "id" | "name" | "email" | "skills">[];
  executorStats: Record<
    string,
    { rating: number; completedOrders: number; latePercent: number }
  >;
  initialChatUnread: boolean;
};

export function applyRealtimeOrderRowToBundleCache(
  queryClient: QueryClient,
  orderId: string,
  row: Record<string, unknown>,
) {
  const parsed = parseOrderRowFromSupabase(row);
  if (!parsed) return;
  queryClient.setQueryData<AdminOrderBundleCached | null>(
    queryKeys.adminOrder(orderId),
    (prev) => {
      if (!prev) return prev;
      if (parsed.deletedAt) return prev;
      const nextOrder = normalizeOrderForClient({
        ...prev.order,
        ...parsed,
        lead: parsed.leadId === prev.order.leadId ? prev.order.lead : null,
        executor:
          parsed.executorId === prev.order.executorId
            ? prev.order.executor
            : null,
        executorUserIds: prev.order.executorUserIds,
        team:
          parsed.teamId === prev.order.teamId ? prev.order.team : undefined,
      } as AdminDetailOrder);
      return { ...prev, order: nextOrder };
    },
  );
}

export function applyRealtimeCheckpointToBundleCache(
  queryClient: QueryClient,
  orderId: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  if (payload.eventType === "DELETE") {
    const old = payload.old as Record<string, unknown> | null;
    const id = old?.id ? String(old.id) : null;
    if (!id) return;
    queryClient.setQueryData<AdminOrderBundleCached | null>(
      queryKeys.adminOrder(orderId),
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          checkpoints: prev.checkpoints.filter((c) => c.id !== id),
        };
      },
    );
    return;
  }
  const row = payload.new as Record<string, unknown> | null;
  if (!row) return;
  const c = parseCheckpointRowFromSupabase(row);
  if (!c) return;

  queryClient.setQueryData<AdminOrderBundleCached | null>(
    queryKeys.adminOrder(orderId),
    (prev) => {
      if (!prev) return prev;
      if (payload.eventType === "INSERT") {
        if (prev.checkpoints.some((x) => x.id === c.id)) return prev;
        const cleaned = prev.checkpoints.filter(
          (x) =>
            !(
              x.id.startsWith("optimistic-") &&
              x.orderId === c.orderId &&
              x.title === c.title
            ),
        );
        return {
          ...prev,
          checkpoints: sortCheckpointsForUi([...cleaned, c]),
        };
      }
      const next = prev.checkpoints.some((x) => x.id === c.id)
        ? prev.checkpoints.map((x) => (x.id === c.id ? c : x))
        : [...prev.checkpoints, c];
      return { ...prev, checkpoints: sortCheckpointsForUi(next) };
    },
  );
}

export function applyRealtimeFileToBundleCache(
  queryClient: QueryClient,
  orderId: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  if (payload.eventType === "DELETE") {
    const old = payload.old as Record<string, unknown> | null;
    const id = old?.id ? String(old.id) : null;
    if (!id) return;
    queryClient.setQueryData<AdminOrderBundleCached | null>(
      queryKeys.adminOrder(orderId),
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          files: prev.files.filter((f) => f.id !== id),
        };
      },
    );
    return;
  }
  const row = payload.new as Record<string, unknown> | null;
  if (!row) return;
  const f = parseFileRowFromSupabase(row);
  if (!f) return;

  queryClient.setQueryData<AdminOrderBundleCached | null>(
    queryKeys.adminOrder(orderId),
    (prev) => {
      if (!prev) return prev;
      if (payload.eventType === "INSERT") {
        if (prev.files.some((x) => x.id === f.id)) return prev;
        return { ...prev, files: [f, ...prev.files] };
      }
      return {
        ...prev,
        files: prev.files.map((x) => (x.id === f.id ? f : x)),
      };
    },
  );
}
