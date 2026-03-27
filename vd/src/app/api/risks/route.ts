import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [overdue, edge, heavyRevisions, bannedExecutors] = await Promise.all([
    prisma.order.findMany({
      where: {
        deadline: { lt: now },
        status: { not: "DONE" },
      },
      include: { executor: true },
      orderBy: { deadline: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: {
        deadline: { gte: now, lte: soon },
        status: { not: "DONE" },
      },
      include: { executor: true },
      orderBy: { deadline: "asc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: { revisionCount: { gt: 2 } },
      include: { executor: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: { role: "executor", status: "banned" },
    }),
  ]);

  return NextResponse.json({
    overdue,
    onTheEdge: edge,
    heavyRevisions,
    bannedExecutors,
  });
}
