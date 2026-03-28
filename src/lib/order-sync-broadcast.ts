import { getSupabaseBrowserClient } from "@/lib/supabase-client";

/** Общий канал для мгновенной синхронизации заказа (этапы и т.д.) между админом и исполнителем. */
export function orderSyncChannelName(orderId: string) {
  return `order-sync:${orderId}`;
}

export const ORDER_SYNC_EVENTS = {
  checkpointCreated: "checkpoint_created",
  checkpointUpdated: "checkpoint_updated",
  checkpointDeleted: "checkpoint_deleted",
  checkpointsRefresh: "checkpoints_refresh",
} as const;

/**
 * Отправка broadcast после успешного API (админка).
 * Отдельная подписка → send → remove, чтобы не зависеть от долгоживущего канала.
 */
export function broadcastOrderSync(
  orderId: string,
  opts: { supabaseUrl?: string; supabaseAnonKey?: string },
  event: string,
  payload: Record<string, unknown>,
): void {
  const sb = getSupabaseBrowserClient(opts);
  if (!sb) return;
  const ch = sb.channel(orderSyncChannelName(orderId));
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void ch.send({ type: "broadcast", event, payload });
      void sb.removeChannel(ch);
    }
  });
}
