import { dbUnavailableUserMessage } from "@/lib/db-unavailable-message";
import prisma from "@/lib/prisma";
import { leadIsActive, orderIsActive } from "@/lib/active-scope";
import { buildDailyProfitSeries } from "@/lib/daily-profit";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
import type { Order } from "@prisma/client";

function rangeStart(period: "day" | "week" | "month"): Date {
  const end = new Date();
  const start = new Date(end);
  if (period === "day") start.setHours(0, 0, 0, 0);
  else if (period === "week") start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return start;
}

export type AdminDashboardPayload = {
  newLeads: number;
  activeOrders: number;
  overdue: number;
  profitSum: number;
  dayProfit: number;
  weekProfit: number;
  monthProfit: number;
  series30: { date: string; profit: number }[];
  recent: (Order & { executor: { name: string } | null })[];
};

export async function loadAdminDashboardData(
  userId: string,
): Promise<{ ok: true; data: AdminDashboardPayload } | { ok: false; message: string }> {
  try {
    const orgIds = await getAccessibleOrganizationIds(userId);
    const orgScope =
      orgIds.length === 0
        ? { id: { in: [] as string[] } }
        : { organizationId: { in: orgIds } };

    const end = new Date();

    const newLeads = await prisma.lead.count({
      where: { status: "NEW", ...leadIsActive },
    });
    const activeOrders = await prisma.order.count({
      where: { ...orderIsActive, ...orgScope, status: { not: "DONE" } },
    });
    const overdue = await prisma.order.count({
      where: {
        ...orderIsActive,
        ...orgScope,
        deadline: { lt: new Date() },
        status: { not: "DONE" },
      },
    });
    const profitSum = await prisma.order.aggregate({
      where: { ...orderIsActive, ...orgScope },
      _sum: { profit: true },
    });
    const dayP = await prisma.order.aggregate({
      where: {
        ...orderIsActive,
        ...orgScope,
        status: "DONE",
        updatedAt: { gte: rangeStart("day"), lte: end },
      },
      _sum: { profit: true },
    });
    const weekP = await prisma.order.aggregate({
      where: {
        ...orderIsActive,
        ...orgScope,
        status: "DONE",
        updatedAt: { gte: rangeStart("week"), lte: end },
      },
      _sum: { profit: true },
    });
    const monthP = await prisma.order.aggregate({
      where: {
        ...orderIsActive,
        ...orgScope,
        status: "DONE",
        updatedAt: { gte: rangeStart("month"), lte: end },
      },
      _sum: { profit: true },
    });
    const series30 = await buildDailyProfitSeries(30, orgIds);
    const recent = await prisma.order.findMany({
      where: { ...orderIsActive, ...orgScope },
      include: { executor: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    return {
      ok: true,
      data: {
        newLeads,
        activeOrders,
        overdue,
        profitSum: Number(profitSum._sum.profit ?? 0),
        dayProfit: Number(dayP._sum.profit ?? 0),
        weekProfit: Number(weekP._sum.profit ?? 0),
        monthProfit: Number(monthP._sum.profit ?? 0),
        series30,
        recent,
      },
    };
  } catch (e) {
    console.error("[loadAdminDashboardData]", e);
    return {
      ok: false,
      message: dbUnavailableUserMessage(e),
    };
  }
}
