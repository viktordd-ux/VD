import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getOrderAccessWhereInput } from "@/lib/order-access";
import { serializeExecutorHomeOrders } from "@/lib/order-list-client-serialize";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "executor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const orders = await prisma.order.findMany({
    where: {
      ...accessWhere,
      status: { not: "DONE" },
    },
    orderBy: { deadline: "asc" },
    include: { orderExecutors: { select: { userId: true } } },
  });

  return NextResponse.json({
    orders: serializeExecutorHomeOrders(orders),
    userId: user.id,
  });
}
