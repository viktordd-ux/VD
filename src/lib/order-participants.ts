import { getOrderExecutorUserIds } from "@/lib/order-executors";

/** Исполнители заказа + участники команды (team), без дубликатов. */
export function getOrderParticipantUserIds(order: {
  executorId: string | null;
  orderExecutors?: { userId: string }[] | null;
  team?: { members?: { userId: string }[] } | null;
}): string[] {
  const execs = getOrderExecutorUserIds(order);
  const fromTeam = order.team?.members?.map((m) => m.userId) ?? [];
  return [...new Set([...execs, ...fromTeam])];
}
