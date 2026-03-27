import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

function rangeStart(period: "day" | "week" | "month"): Date {
  const end = new Date();
  const start = new Date(end);
  if (period === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  return start;
}

async function profitInPeriod(start: Date, end: Date) {
  return prisma.order.aggregate({
    where: {
      status: "DONE",
      updatedAt: { gte: start, lte: end },
    },
    _sum: { profit: true },
  });
}

export async function GET() {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const end = new Date();

  const [totals, byStatus, day, week, month] = await Promise.all([
    prisma.order.aggregate({
      _sum: {
        budgetClient: true,
        budgetExecutor: true,
        profit: true,
      },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _sum: {
        profit: true,
      },
    }),
    profitInPeriod(rangeStart("day"), end),
    profitInPeriod(rangeStart("week"), end),
    profitInPeriod(rangeStart("month"), end),
  ]);

  return NextResponse.json({
    totals: {
      orders: totals._count,
      budgetClient: totals._sum.budgetClient?.toString() ?? "0",
      budgetExecutor: totals._sum.budgetExecutor?.toString() ?? "0",
      profit: totals._sum.profit?.toString() ?? "0",
    },
    byStatus,
    profitByPeriod: {
      day: day._sum.profit?.toString() ?? "0",
      week: week._sum.profit?.toString() ?? "0",
      month: month._sum.profit?.toString() ?? "0",
    },
  });
}
