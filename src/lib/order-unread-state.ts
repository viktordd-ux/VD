import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOrderAccessWhereInput } from "@/lib/order-access";
import {
  computeOrderUnreadFlags,
  projectLastActivityAt,
  type OrderUnreadFlags,
} from "@/lib/order-unread-service";

export type { OrderUnreadFlags };

const MAX_IDS = 400;
const UNREAD_COUNT_CHUNK = 500;

/** Заказы из списка, к которым у пользователя есть доступ (для batch API). */
export async function filterAccessibleOrderIds(
  userId: string,
  orderIds: string[],
): Promise<string[]> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) return [];
  const accessWhere = await getOrderAccessWhereInput(userId);
  const rows = await prisma.order.findMany({
    where: { AND: [{ id: { in: ids } }, accessWhere] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Загрузка флагов непрочитанного по заказам (единая точка чтения БД + сервис).
 */
export async function getUnreadFlagsForOrders(
  userId: string,
  orderIds: string[],
): Promise<Map<string, OrderUnreadFlags>> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_IDS);
  const out = new Map<string, OrderUnreadFlags>();
  if (ids.length === 0) return out;

  const accessWhere = await getOrderAccessWhereInput(userId);
  const orderWhere: Prisma.OrderWhereInput = {
    AND: [{ id: { in: ids } }, accessWhere],
  };

  const [orders, states, msgGroups, fileGroups, cpGroups] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      select: { id: true, updatedAt: true },
    }),
    prisma.orderUserReadState.findMany({
      where: { userId, orderId: { in: ids } },
    }),
    prisma.message.groupBy({
      by: ["orderId"],
      where: { orderId: { in: ids }, senderId: { not: userId } },
      _max: { createdAt: true },
    }),
    prisma.file.groupBy({
      by: ["orderId"],
      where: { orderId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.checkpoint.groupBy({
      by: ["orderId"],
      where: { orderId: { in: ids } },
      _max: { updatedAt: true },
    }),
  ]);

  const stateBy = new Map(states.map((s) => [s.orderId, s]));
  const msgMax = new Map(
    msgGroups.map((g) => [g.orderId, g._max.createdAt] as const),
  );
  const fileMax = new Map(
    fileGroups.map((g) => [g.orderId, g._max.createdAt] as const),
  );
  const cpMax = new Map(
    cpGroups.map((g) => [g.orderId, g._max.updatedAt] as const),
  );

  for (const order of orders) {
    const state = stateBy.get(order.id);
    const chatLastActivityAt = msgMax.get(order.id) ?? null;
    const projectActivityAt = projectLastActivityAt({
      orderUpdatedAt: order.updatedAt,
      filesMaxCreatedAt: fileMax.get(order.id) ?? null,
      checkpointsMaxUpdatedAt: cpMax.get(order.id) ?? null,
    });

    const flags = computeOrderUnreadFlags({
      chatLastActivityAt,
      projectLastActivityAt: projectActivityAt,
      read: {
        chatReadAt: state?.chatReadAt ?? null,
        projectReadAt: state?.projectReadAt ?? null,
      },
    });

    out.set(order.id, flags);
  }

  return out;
}

/** Сколько заказов в зоне доступа с непрочитанным входящим чатом (для бейджа в навигации). */
export async function getUnreadChatOrderCount(userId: string): Promise<number> {
  const accessWhere = await getOrderAccessWhereInput(userId);
  const orderRows = await prisma.order.findMany({
    where: accessWhere,
    select: { id: true },
  });
  const orderIds = orderRows.map((r) => r.id);
  if (orderIds.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < orderIds.length; i += UNREAD_COUNT_CHUNK) {
    const slice = orderIds.slice(i, i + UNREAD_COUNT_CHUNK);
    const rows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT m.order_id)::bigint AS c
      FROM messages m
      LEFT JOIN order_user_read_state s
        ON s.order_id = m.order_id AND s.user_id = ${userId}
      WHERE m.sender_id != ${userId}
        AND m.order_id IN (${Prisma.join(slice)})
        AND (s.chat_read_at IS NULL OR m.created_at > s.chat_read_at)
    `;
    total += Number(rows[0]?.c ?? 0);
  }
  return total;
}
