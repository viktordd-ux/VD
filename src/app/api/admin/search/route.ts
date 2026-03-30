import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";

const LIMIT = 8;

/** GET /api/admin/search?q= — заказы, исполнители, лиды (для Command Palette). */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

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
        ...orderIsActive,
        OR: [{ title: contains }, { clientName: contains }, { platform: contains }],
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
