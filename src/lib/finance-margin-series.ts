import type { Order } from "@prisma/client";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";

export type MarginBarPoint = { name: string; marginPct: number; profit: number };

function aggregateByExecutor(
  orders: Pick<Order, "profit" | "budgetClient" | "executorId">[],
  nameById: Map<string, string>,
): MarginBarPoint[] {
  const map = new Map<string, { profit: number; budget: number }>();
  for (const o of orders) {
    const id = o.executorId;
    if (!id) continue;
    const cur = map.get(id) ?? { profit: 0, budget: 0 };
    cur.profit += Number(o.profit);
    cur.budget += Number(o.budgetClient);
    map.set(id, cur);
  }
  return [...map.entries()]
    .map(([id, v]) => ({
      name: nameById.get(id) ?? id.slice(0, 6),
      marginPct: v.budget > 0 ? (v.profit / v.budget) * 100 : 0,
      profit: v.profit,
    }))
    .sort((a, b) => b.marginPct - a.marginPct);
}

function rollingWindow(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export async function buildMarginSeriesByExecutor(opts: {
  executorId?: string;
  lowMargin?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<{
  series1: MarginBarPoint[];
  series7: MarginBarPoint[];
  series30: MarginBarPoint[];
}> {
  const users = await prisma.user.findMany({
    where: { role: "executor" },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const execFilter = opts.executorId
    ? { executorId: opts.executorId }
    : {};

  async function loadRange(start: Date, end: Date) {
    const orders = await prisma.order.findMany({
      where: {
        ...orderIsActive,
        status: "DONE",
        ...execFilter,
        updatedAt: { gte: start, lte: end },
      },
      select: { profit: true, budgetClient: true, executorId: true },
    });
    let list = orders;
    if (opts.lowMargin) {
      list = list.filter((o) => {
        const bc = Number(o.budgetClient);
        return bc > 0 && Number(o.profit) / bc < 0.5;
      });
    }
    return aggregateByExecutor(list, nameById);
  }

  if (opts.dateFrom && opts.dateTo) {
    const agg = await loadRange(opts.dateFrom, opts.dateTo);
    return { series1: agg, series7: agg, series30: agg };
  }

  const [w1, w7, w30] = [1, 7, 30].map((d) => rollingWindow(d));
  const series1 = await loadRange(w1.start, w1.end);
  const series7 = await loadRange(w7.start, w7.end);
  const series30 = await loadRange(w30.start, w30.end);

  return { series1, series7, series30 };
}
