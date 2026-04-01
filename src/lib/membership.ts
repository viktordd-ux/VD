import prisma from "@/lib/prisma";

/**
 * Участие пользователя в организации (для проверок доступа по org).
 */
export async function getUserMembership(userId: string, organizationId: string) {
  return prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    include: { organization: true },
  });
}
