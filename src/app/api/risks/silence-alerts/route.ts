import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { getOrderRiskFlags } from "@/lib/order-risk";

/** Для toast/polling: заказы с флагами тишины по порогам env. */
export async function GET() {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      status: { not: "DONE" },
      executorId: { not: null },
    },
    include: { executor: true, checkpoints: true, files: true },
    take: 300,
    orderBy: { updatedAt: "desc" },
  });

  const alerts: {
    orderId: string;
    title: string;
    level: "warn" | "high";
    flags: string[];
  }[] = [];

  for (const o of orders) {
    const f = getOrderRiskFlags(o, o.checkpoints, o.files);
    if (f.redSilent) {
      alerts.push({
        orderId: o.id,
        title: o.title,
        level: "high",
        flags: ["silent_high"],
      });
    } else if (f.yellowSilent) {
      alerts.push({
        orderId: o.id,
        title: o.title,
        level: "warn",
        flags: ["silent_warn"],
      });
    }
  }

  return NextResponse.json({ alerts });
}
