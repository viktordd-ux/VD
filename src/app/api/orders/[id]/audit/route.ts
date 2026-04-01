import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getOrderAccessWhereInput } from "@/lib/order-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...accessWhere },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [cps, files] = await Promise.all([
    prisma.checkpoint.findMany({
      where: { orderId },
      select: { id: true },
    }),
    prisma.file.findMany({
      where: { orderId },
      select: { id: true },
    }),
  ]);

  const rows = await prisma.auditLog.findMany({
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
    take: 150,
    include: {
      changedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(rows);
}
