import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { serializeExecutorHomeOrders } from "@/lib/order-list-client-serialize";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "executor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      executorId: user.id,
      status: { not: "DONE" },
    },
    orderBy: { deadline: "asc" },
  });

  return NextResponse.json({
    orders: serializeExecutorHomeOrders(orders),
    userId: user.id,
  });
}
