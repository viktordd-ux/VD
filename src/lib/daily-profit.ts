import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";

/** Серия по календарным дням (UTC date key), прибыль по DONE-заказам по updatedAt. */
export async function buildDailyProfitSeries(
  days: number,
  organizationIds: string[],
): Promise<{ date: string; profit: number }[]> {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const orgScope =
    organizationIds.length === 0
      ? { id: { in: [] as string[] } }
      : { organizationId: { in: organizationIds } };

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      ...orgScope,
      status: "DONE",
      updatedAt: { gte: start, lte: end },
    },
    select: { profit: true, updatedAt: true },
  });

  const map = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of orders) {
    const k = o.updatedAt.toISOString().slice(0, 10);
    if (map.has(k)) {
      map.set(k, (map.get(k) ?? 0) + Number(o.profit));
    }
  }
  return [...map.entries()].map(([date, profit]) => ({ date, profit }));
}
