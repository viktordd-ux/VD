import prisma from "@/lib/prisma";

/** Команда принадлежит организации заказа. */
export async function resolveTeamIdForOrder(
  organizationId: string,
  teamId: string | null | undefined,
): Promise<string | null> {
  const tid = typeof teamId === "string" ? teamId.trim() : "";
  if (!tid) return null;
  const team = await prisma.team.findFirst({
    where: { id: tid, organizationId },
    select: { id: true },
  });
  return team?.id ?? null;
}
