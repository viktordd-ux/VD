import prisma from "@/lib/prisma";

export async function getAccessibleOrganizationIds(userId: string): Promise<string[]> {
  const rows = await prisma.membership.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}

/** Первая организация пользователя (создание заказов без выбора org в UI). */
export async function getPrimaryOrganizationIdForUser(userId: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return m?.organizationId ?? null;
}

export { getOrderAccessWhereInput } from "@/lib/order-access";
