import { MembershipRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  canParticipateInOrderChat,
  isStaffMembershipRole,
  loadOrderForAccess,
  ORDER_CHAT_STAFF_ROLES,
} from "@/lib/order-access";
import { getOrderExecutorUserIds } from "@/lib/order-executors";

export { isStaffMembershipRole, ORDER_CHAT_STAFF_ROLES };

export type OrderForChatAccess = NonNullable<
  Awaited<ReturnType<typeof loadOrderForChatAccess>>
>;

export const loadOrderForChatAccess = loadOrderForAccess;

export async function userCanAccessOrderChat(
  userId: string,
  order: OrderForChatAccess,
): Promise<boolean> {
  return canParticipateInOrderChat(userId, order);
}

/**
 * Исполнители заказа + OWNER/ADMIN org + MANAGER только из команды заказа (если есть teamId).
 */
export async function getOrderChatParticipantUserIds(
  order: OrderForChatAccess,
): Promise<string[]> {
  const set = new Set(getOrderExecutorUserIds(order));

  const ownerAdmins = await prisma.membership.findMany({
    where: {
      organizationId: order.organizationId,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
    },
    select: { userId: true },
  });
  for (const r of ownerAdmins) set.add(r.userId);

  if (order.teamId) {
    const managers = await prisma.membership.findMany({
      where: {
        organizationId: order.organizationId,
        role: MembershipRole.MANAGER,
      },
      select: { userId: true },
    });
    const teamMemberRows = await prisma.teamMember.findMany({
      where: { teamId: order.teamId },
      select: { userId: true },
    });
    const inTeam = new Set(teamMemberRows.map((t) => t.userId));
    for (const m of managers) {
      if (inTeam.has(m.userId)) set.add(m.userId);
    }
  }

  return [...set];
}

export type ChatParticipantDto = {
  userId: string;
  name: string;
  kind: "staff" | "assignee";
};

export async function buildChatParticipants(
  order: OrderForChatAccess,
): Promise<ChatParticipantDto[]> {
  const ids = await getOrderChatParticipantUserIds(order);
  if (ids.length === 0) return [];

  const [users, memberships] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.membership.findMany({
      where: {
        organizationId: order.organizationId,
        userId: { in: ids },
      },
      select: { userId: true, role: true },
    }),
  ]);

  const roleByUser = new Map(memberships.map((m) => [m.userId, m.role]));

  return users.map((u) => {
    const role = roleByUser.get(u.id);
    const kind =
      role && isStaffMembershipRole(role) ? ("staff" as const) : ("assignee" as const);
    return { userId: u.id, name: u.name, kind };
  });
}

/** Ссылка на карточку заказа для уведомлений (админка vs кабинет исполнителя). */
export function chatOrderHrefForUser(
  orderId: string,
  membershipRole: MembershipRole | undefined,
): string {
  if (membershipRole && isStaffMembershipRole(membershipRole)) {
    return `/admin/orders/${orderId}`;
  }
  return `/executor/orders/${orderId}`;
}
