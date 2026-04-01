import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
import { getOrderRiskFlags } from "@/lib/order-risk";

/** Для toast/polling: заказы с флагами тишины по порогам env. */
export async function GET() {
  const user = await requireStaff();
  if (user instanceof NextResponse) return user;

  const orgIds = await getAccessibleOrganizationIds(user.id);
  const orgScope =
    orgIds.length === 0
      ? { id: { in: [] as string[] } }
      : { organizationId: { in: orgIds } };

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      ...orgScope,
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
