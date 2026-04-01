import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getOrderAccessWhereInput } from "@/lib/order-access";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";

const LIMIT = 8;

/** GET /api/admin/search?q= — заказы, исполнители, лиды (для Command Palette). */
export async function GET(req: Request) {
  const admin = await requireUser();
  if (admin instanceof NextResponse) return admin;

  const orgIds = await getAccessibleOrganizationIds(admin.id);
  const accessWhere = await getOrderAccessWhereInput(admin.id);

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({
      orders: [],
      executors: [],
      leads: [],
    });
  }

  const contains = { contains: q, mode: "insensitive" as const };

  const [orders, executors, leads] = await Promise.all([
    prisma.order.findMany({
      where: {
        AND: [
          accessWhere,
          { OR: [{ title: contains }, { clientName: contains }, { platform: contains }] },
        ],
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        status: true,
      },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
    }),
    prisma.user.findMany({
      where: {
        role: "executor",
        status: "active",
        memberships: { some: { organizationId: { in: orgIds } } },
        OR: [
          { name: contains },
          { email: contains },
          { firstName: contains },
          { lastName: contains },
        ],
      },
      select: { id: true, name: true, email: true },
      take: LIMIT,
    }),
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        OR: [{ clientName: contains }, { platform: contains }, { text: contains }],
      },
      select: { id: true, clientName: true, platform: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
    }),
  ]);

  return NextResponse.json({ orders, executors, leads });
}
