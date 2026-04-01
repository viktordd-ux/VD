import type { OrderExecutor } from "@prisma/client";
import prisma from "@/lib/prisma";

export type OrderWithExecutorLinks = {
  executorId: string | null;
  orderExecutors?: Pick<OrderExecutor, "userId">[] | null;
};

export function getOrderExecutorUserIds(order: OrderWithExecutorLinks): string[] {
  const fromJoin = order.orderExecutors?.map((r) => r.userId) ?? [];
  if (order.executorId) {
    const rest = fromJoin.filter((id) => id !== order.executorId);
    return [order.executorId, ...rest];
  }
  return [...new Set(fromJoin)];
}

export function userIsOrderExecutor(order: OrderWithExecutorLinks, userId: string): boolean {
  if (order.executorId === userId) return true;
  return order.orderExecutors?.some((r) => r.userId === userId) ?? false;
}

/** Полная замена списка исполнителей; `executor_id` = первый в списке (или null). */
export async function replaceOrderExecutors(orderId: string, userIds: string[]): Promise<void> {
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  const primary = unique[0] ?? null;
  await prisma.$transaction(async (tx) => {
    await tx.orderExecutor.deleteMany({ where: { orderId } });
    if (unique.length > 0) {
      await tx.orderExecutor.createMany({
        data: unique.map((userId) => ({ orderId, userId })),
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { executorId: primary },
    });
  });
}

/** Все id должны быть активными исполнителями с членством в организации заказа. */
export async function assertUsersAreOrgExecutors(
  organizationId: string,
  userIds: string[],
): Promise<void> {
  const uniq = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (uniq.length === 0) return;
  const n = await prisma.user.count({
    where: {
      id: { in: uniq },
      role: "executor",
      status: "active",
      memberships: { some: { organizationId } },
    },
  });
  if (n !== uniq.length) {
    throw new Error("INVALID_ORDER_EXECUTORS");
  }
}
