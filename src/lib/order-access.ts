import { MembershipRole, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { userIsOrderExecutor } from "@/lib/order-executors";

export type OrderAccessSnapshot = {
  id: string;
  organizationId: string;
  teamId: string | null;
  executorId: string | null;
  orderExecutors?: { userId: string }[] | null;
};

export async function loadOrderForAccess(orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    include: { orderExecutors: { select: { userId: true } } },
  });
}

export async function getMembership(userId: string, organizationId: string) {
  return prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
}

export async function getUserTeamIdsInOrganization(
  userId: string,
  organizationId: string,
): Promise<string[]> {
  const rows = await prisma.teamMember.findMany({
    where: { userId, team: { organizationId } },
    select: { teamId: true },
  });
  return rows.map((r) => r.teamId);
}

/** Роли «руководство» в организации (для UI, уведомлений, чата). */
export const ORDER_CHAT_STAFF_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
];

/** OWNER / ADMIN — полный доступ в организации; MANAGER — в рамках команд; не VIEWER. */
export function isStaffMembershipRole(role: MembershipRole): boolean {
  return ORDER_CHAT_STAFF_ROLES.includes(role);
}

/**
 * Чтение заказа: OWNER/ADMIN/VIEWER — всё в org; MANAGER — заказы своих команд;
 * EXECUTOR — только назначенные.
 */
export async function canAccessOrder(userId: string, orderId: string): Promise<boolean> {
  const order = await loadOrderForAccess(orderId);
  if (!order) return false;
  return canAccessOrderForOrder(userId, order);
}

export async function canAccessOrderForOrder(
  userId: string,
  order: OrderAccessSnapshot,
): Promise<boolean> {
  const m = await getMembership(userId, order.organizationId);
  if (!m) return false;
  switch (m.role) {
    case MembershipRole.OWNER:
    case MembershipRole.ADMIN:
    case MembershipRole.VIEWER:
      return true;
    case MembershipRole.MANAGER: {
      if (!order.teamId) return false;
      const teamIds = await getUserTeamIdsInOrganization(userId, order.organizationId);
      return teamIds.includes(order.teamId);
    }
    case MembershipRole.EXECUTOR:
      return userIsOrderExecutor(order, userId);
    default:
      return false;
  }
}

/** VIEWER — read-only. */
export async function canWriteOrder(userId: string, orderId: string): Promise<boolean> {
  const order = await loadOrderForAccess(orderId);
  if (!order) return false;
  return canWriteOrderForOrder(userId, order);
}

export async function canWriteOrderForOrder(
  userId: string,
  order: OrderAccessSnapshot,
): Promise<boolean> {
  const m = await getMembership(userId, order.organizationId);
  if (!m) return false;
  if (m.role === MembershipRole.VIEWER) return false;
  switch (m.role) {
    case MembershipRole.OWNER:
    case MembershipRole.ADMIN:
      return true;
    case MembershipRole.MANAGER: {
      if (!order.teamId) return false;
      const teamIds = await getUserTeamIdsInOrganization(userId, order.organizationId);
      return teamIds.includes(order.teamId);
    }
    case MembershipRole.EXECUTOR:
      return userIsOrderExecutor(order, userId);
    default:
      return false;
  }
}

/**
 * Управление заказом как «руководство» (не исполнитель): чекпоинты, удаление файлов,
 * PATCH заказа от админки. MANAGER — только свои команды.
 */
export async function canStaffManageOrder(userId: string, orderId: string): Promise<boolean> {
  const order = await loadOrderForAccess(orderId);
  if (!order) return false;
  const m = await getMembership(userId, order.organizationId);
  if (!m) return false;
  if (m.role === MembershipRole.OWNER || m.role === MembershipRole.ADMIN) return true;
  if (m.role === MembershipRole.MANAGER) {
    if (!order.teamId) return false;
    const teamIds = await getUserTeamIdsInOrganization(userId, order.organizationId);
    return teamIds.includes(order.teamId);
  }
  return false;
}

/** Жёсткое удаление заказа — только OWNER/ADMIN организации. */
export async function canHardDeleteOrder(userId: string, orderId: string): Promise<boolean> {
  const order = await loadOrderForAccess(orderId);
  if (!order) return false;
  const m = await getMembership(userId, order.organizationId);
  if (!m) return false;
  return m.role === MembershipRole.OWNER || m.role === MembershipRole.ADMIN;
}

/** Участие в чате (чтение + отправка); VIEWER не в чате. */
export async function canParticipateInOrderChat(
  userId: string,
  order: OrderAccessSnapshot,
): Promise<boolean> {
  const m = await getMembership(userId, order.organizationId);
  if (!m) return false;
  if (m.role === MembershipRole.VIEWER) return false;
  switch (m.role) {
    case MembershipRole.OWNER:
    case MembershipRole.ADMIN:
      return true;
    case MembershipRole.MANAGER: {
      if (!order.teamId) return false;
      const teamIds = await getUserTeamIdsInOrganization(userId, order.organizationId);
      return teamIds.includes(order.teamId);
    }
    case MembershipRole.EXECUTOR:
      return userIsOrderExecutor(order, userId);
    default:
      return false;
  }
}

/**
 * Фильтр списков заказов по membership: VIEWER видит org; MANAGER — только команды,
 * в которых состоит; EXECUTOR — только свои заказы.
 */
export async function getOrderAccessWhereInput(userId: string): Promise<Prisma.OrderWhereInput> {
  const memberships = await prisma.membership.findMany({ where: { userId } });
  if (memberships.length === 0) return { id: { in: [] } };

  const teamRows = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true, team: { select: { organizationId: true } } },
  });
  const teamsByOrg = new Map<string, Set<string>>();
  for (const r of teamRows) {
    let set = teamsByOrg.get(r.team.organizationId);
    if (!set) {
      set = new Set();
      teamsByOrg.set(r.team.organizationId, set);
    }
    set.add(r.teamId);
  }

  const or: Prisma.OrderWhereInput[] = [];

  for (const m of memberships) {
    const orgId = m.organizationId;
    const base: Prisma.OrderWhereInput = { ...orderIsActive, organizationId: orgId };

    switch (m.role) {
      case MembershipRole.OWNER:
      case MembershipRole.ADMIN:
      case MembershipRole.VIEWER:
        or.push(base);
        break;
      case MembershipRole.MANAGER: {
        const set = teamsByOrg.get(orgId);
        const teamIds = set ? [...set] : [];
        if (teamIds.length === 0) break;
        or.push({ ...base, teamId: { in: teamIds } });
        break;
      }
      case MembershipRole.EXECUTOR:
        or.push({
          ...base,
          OR: [
            { executorId: userId },
            { orderExecutors: { some: { userId } } },
          ],
        });
        break;
      default:
        break;
    }
  }

  return or.length === 0 ? { id: { in: [] } } : { OR: or };
}

/** Роль сериализации карточки заказа: бюджет/лид только не для «чистого» исполнителя. */
export async function getSerializeOrderRoleForUser(
  userId: string,
  organizationId: string,
): Promise<"admin" | "executor"> {
  const m = await getMembership(userId, organizationId);
  if (m?.role === MembershipRole.EXECUTOR) return "executor";
  return "admin";
}

/** Есть ли у пользователя расширенный список заказов (лид, маржа и т.д.). */
export async function userHasExtendedOrderListView(userId: string): Promise<boolean> {
  const m = await prisma.membership.findFirst({
    where: {
      userId,
      role: {
        in: [
          MembershipRole.OWNER,
          MembershipRole.ADMIN,
          MembershipRole.MANAGER,
          MembershipRole.VIEWER,
        ],
      },
    },
  });
  return m != null;
}
