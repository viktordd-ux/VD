import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

/** Объединённая история: аудит + актуальные чекпоинты (для вкладок UI). */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  const [cps, files, checkpoints] = await Promise.all([
    prisma.checkpoint.findMany({
      where: { orderId },
      select: { id: true },
    }),
    prisma.file.findMany({
      where: { orderId },
      select: { id: true },
    }),
    prisma.checkpoint.findMany({
      where: { orderId },
      orderBy: [{ position: "asc" }, { dueDate: "asc" }],
    }),
  ]);

  const audit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "order", entityId: orderId },
        {
          entityType: "checkpoint",
          entityId: { in: cps.map((c) => c.id) },
        },
        {
          entityType: "file",
          entityId: { in: files.map((f) => f.id) },
        },
      ],
    },
    orderBy: { changedAt: "desc" },
    take: 200,
    include: {
      changedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json({
    audit,
    checkpoints,
    merged: audit.map((a) => ({
      kind: "audit" as const,
      id: a.id,
      actionType: a.actionType,
      changedAt: a.changedAt.toISOString(),
      entityType: a.entityType,
      entityId: a.entityId,
      changedBy: a.changedBy,
    })),
  });
}
