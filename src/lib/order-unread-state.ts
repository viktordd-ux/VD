import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import {
  computeOrderUnreadFlags,
  projectLastActivityAt,
  type OrderUnreadFlags,
} from "@/lib/order-unread-service";

export type { OrderUnreadFlags };

const MAX_IDS = 400;

/** Заказы из списка, к которым у пользователя есть доступ (для batch API). */
export async function filterAccessibleOrderIds(
  userId: string,
  role: "admin" | "executor",
  orderIds: string[],
): Promise<string[]> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) return [];
  const where: Prisma.OrderWhereInput =
    role === "admin"
      ? { id: { in: ids }, ...orderIsActive }
      : { id: { in: ids }, ...orderIsActive, executorId: userId };
  const rows = await prisma.order.findMany({ where, select: { id: true } });
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

  const orderWhere: Prisma.OrderWhereInput = { id: { in: ids }, ...orderIsActive };

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

/**
 * Есть ли хотя бы один заказ в зоне видимости роли, где непрочитан чат.
 * Семантика совпадает с {@link getUnreadFlagsForOrders} (per-order max сообщений от других).
 */
export async function getHasAnyUnreadChat(
  userId: string,
  role: "admin" | "executor",
): Promise<boolean> {
  if (role === "admin") {
    const rows = await prisma.$queryRaw<{ has_unread: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM messages m
        INNER JOIN orders o ON o.id = m.order_id AND o.deleted_at IS NULL
        LEFT JOIN order_user_read_state s
          ON s.order_id = m.order_id AND s.user_id = ${userId}
        WHERE m.sender_id != ${userId}
          AND (s.chat_read_at IS NULL OR m.created_at > s.chat_read_at)
      ) AS has_unread
    `;
    return Boolean(rows[0]?.has_unread);
  }

  const rows = await prisma.$queryRaw<{ has_unread: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM messages m
      INNER JOIN orders o ON o.id = m.order_id AND o.deleted_at IS NULL
      LEFT JOIN order_user_read_state s
        ON s.order_id = m.order_id AND s.user_id = ${userId}
      WHERE m.sender_id != ${userId}
        AND o.executor_id = ${userId}
        AND (s.chat_read_at IS NULL OR m.created_at > s.chat_read_at)
    ) AS has_unread
  `;
  return Boolean(rows[0]?.has_unread);
}

/** Сколько заказов в зоне роли с непрочитанным входящим чатом (для бейджа в навигации). */
export async function getUnreadChatOrderCount(
  userId: string,
  role: "admin" | "executor",
): Promise<number> {
  if (role === "admin") {
    const rows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT m.order_id)::bigint AS c
      FROM messages m
      INNER JOIN orders o ON o.id = m.order_id AND o.deleted_at IS NULL
      LEFT JOIN order_user_read_state s
        ON s.order_id = m.order_id AND s.user_id = ${userId}
      WHERE m.sender_id != ${userId}
        AND (s.chat_read_at IS NULL OR m.created_at > s.chat_read_at)
    `;
    return Number(rows[0]?.c ?? 0);
  }

  const rows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(DISTINCT m.order_id)::bigint AS c
    FROM messages m
    INNER JOIN orders o ON o.id = m.order_id AND o.deleted_at IS NULL
    LEFT JOIN order_user_read_state s
      ON s.order_id = m.order_id AND s.user_id = ${userId}
    WHERE m.sender_id != ${userId}
      AND o.executor_id = ${userId}
      AND (s.chat_read_at IS NULL OR m.created_at > s.chat_read_at)
  `;
  return Number(rows[0]?.c ?? 0);
}
