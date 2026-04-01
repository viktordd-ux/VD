import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

/**
 * Все организации текущего пользователя с ролью в каждой (многие-ко-многим через Membership).
 */
export async function GET() {
  const sessionUser = await requireUser();
  if (sessionUser instanceof NextResponse) return sessionUser;

  const memberships = await prisma.membership.findMany({
    where: { userId: sessionUser.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    organizations: memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      ...m.organization,
    })),
  });
}
