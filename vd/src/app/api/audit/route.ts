import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const take = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  const rows = await prisma.auditLog.findMany({
    where:
      entityType && entityId
        ? { entityType, entityId }
        : undefined,
    orderBy: { changedAt: "desc" },
    take,
    include: {
      changedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(rows);
}
