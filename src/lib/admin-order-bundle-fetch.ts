import { hydrateOrderBundleFromApi } from "@/lib/hydrate-order-bundle";
import type { AdminOrderBundleCached } from "@/lib/react-query-realtime";

/** Общий fetch для useQuery и prefetch (карточка заказа админки). */
export async function fetchAdminOrderBundle(
  orderId: string,
): Promise<AdminOrderBundleCached | null> {
  const res = await fetch(`/api/admin/orders/${orderId}/bundle`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  const raw = (await res.json()) as {
    order: Record<string, unknown>;
    checkpoints: Record<string, unknown>[];
    files: Record<string, unknown>[];
    executors: AdminOrderBundleCached["executors"];
    executorStats: AdminOrderBundleCached["executorStats"];
    initialChatUnread: boolean;
  };
  const h = hydrateOrderBundleFromApi({
    order: raw.order,
    checkpoints: raw.checkpoints,
    files: raw.files,
  });
  return {
    order: h.order,
    checkpoints: h.checkpoints,
    files: h.files,
    executors: raw.executors,
    executorStats: raw.executorStats,
    initialChatUnread: raw.initialChatUnread,
  };
}
