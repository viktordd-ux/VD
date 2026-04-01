import type { User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";

export type ExecutorMetrics = {
  executorId: string;
  /** Доля просрочек среди завершённых заказов с дедлайном, % */
  overduePct: number;
  latePercent: number;
  avgDaysToComplete: number | null;
  /** Средний срок выполнения (часы): createdAt → updatedAt для DONE */
  avgResponseTime: number | null;
  totalProfit: number;
  doneCount: number;
  completedOrders: number;
  /** 0–100, совпадает с rating (legacy-имя) */
  score: number;
  /** Итог по формуле с punctuality, объёмом, скоростью, надёжностью */
  rating: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Доля требуемых навыков, покрытых исполнителем (0–1). Пустой список требований → 1. */
export function skillMatchRatio(required: string[], executorSkills: string[]): number {
  const req = required.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (req.length === 0) return 1;
  const set = new Set(executorSkills.map((s) => s.trim().toLowerCase()).filter(Boolean));
  let hit = 0;
  for (const r of req) {
    if ([...set].some((e) => e === r || e.includes(r) || r.includes(e))) hit++;
  }
  return hit / req.length;
}

/**
 * Рейтинг 0–100+ (может слегка превысить 100 из-за суммы весов при высоких нормализациях).
 * completedOrders и компоненты speed/reliability нормализуются в 0–100.
 */
export function computeExecutorRatingForSingle(m: {
  overduePct: number;
  doneCount: number;
  avgDaysToComplete: number | null;
  totalProfit: number;
}): number {
  const latePercent = m.overduePct;
  const normCompleted = clamp(Math.log10(m.doneCount + 1) * 25, 0, 100);
  const speedScore =
    m.avgDaysToComplete != null
      ? clamp(100 - m.avgDaysToComplete * 2, 0, 100)
      : 50;
  const reliabilityScore = clamp(Math.log10(m.totalProfit + 10) * 22, 0, 100);
  return (
    (100 - latePercent) * 0.4 +
    normCompleted * 0.2 +
    speedScore * 0.2 +
    reliabilityScore * 0.2
  );
}

/** Пакетный пересчёт: нормализация объёма и скорости по когорте исполнителей. */
export function computeExecutorRatingBatch(metricsMap: Map<string, ExecutorMetrics>): void {
  const ids = [...metricsMap.keys()];
  if (ids.length === 0) return;

  const doneCounts = ids.map((id) => metricsMap.get(id)!.doneCount);
  const maxDone = Math.max(...doneCounts, 0);

  const avgs = ids
    .map((id) => metricsMap.get(id)!.avgDaysToComplete)
    .filter((x): x is number => x != null);
  const minD = avgs.length ? Math.min(...avgs) : 0;
  const maxD = avgs.length ? Math.max(...avgs, minD + 1e-6) : 1;

  const profits = ids.map((id) => metricsMap.get(id)!.totalProfit);
  const maxP = Math.max(...profits, 1);

  for (const id of ids) {
    const m = metricsMap.get(id)!;
    const latePercent = m.overduePct;
    const normCompleted =
      maxDone > 0 ? clamp((m.doneCount / maxDone) * 100, 0, 100) : m.doneCount > 0 ? 50 : 0;
    const ad = m.avgDaysToComplete ?? (minD + maxD) / 2;
    const speedScore = avgs.length
      ? clamp(100 - ((ad - minD) / (maxD - minD)) * 100, 0, 100)
      : m.avgDaysToComplete != null
        ? clamp(100 - m.avgDaysToComplete * 2, 0, 100)
        : 50;
    const reliabilityScore = clamp((m.totalProfit / maxP) * 100, 0, 100);
    const rating =
      (100 - latePercent) * 0.4 +
      normCompleted * 0.2 +
      speedScore * 0.2 +
      reliabilityScore * 0.2;
    const rounded = Math.round(rating * 10) / 10;
    m.rating = rounded;
    m.score = rounded;
  }
}

export function metricsFromOrders(
  orders: Array<{
    deadline: Date | null;
    updatedAt: Date;
    createdAt: Date;
    profit: unknown;
  }>,
): Omit<ExecutorMetrics, "executorId"> {
  let totalProfit = 0;
  let sumDays = 0;
  let daysCount = 0;
  let late = 0;
  let withDl = 0;

  for (const o of orders) {
    totalProfit += Number(o.profit);
    const days =
      (o.updatedAt.getTime() - o.createdAt.getTime()) / 86_400_000;
    if (Number.isFinite(days) && days >= 0) {
      sumDays += days;
      daysCount++;
    }
    if (o.deadline) {
      withDl++;
      if (o.updatedAt.getTime() > o.deadline.getTime()) late++;
    }
  }

  const overduePct = withDl ? (late / withDl) * 100 : 0;
  const avgDaysToComplete = daysCount > 0 ? sumDays / daysCount : null;
  const avgResponseTime = avgDaysToComplete !== null ? avgDaysToComplete * 24 : null;

  return {
    overduePct,
    latePercent: overduePct,
    avgDaysToComplete,
    avgResponseTime,
    totalProfit,
    doneCount: orders.length,
    completedOrders: orders.length,
    rating: 0,
    score: 0,
  };
}

/** Метрики по одному исполнителю (завершённые заказы в переданных организациях). */
export async function getExecutorMetrics(
  executorId: string,
  organizationIds: string[],
): Promise<ExecutorMetrics> {
  const orgFilter =
    organizationIds.length > 0
      ? { organizationId: { in: organizationIds } }
      : { id: { in: [] as string[] } };
  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      executorId,
      status: "DONE",
      ...orgFilter,
    },
    select: {
      deadline: true,
      updatedAt: true,
      createdAt: true,
      profit: true,
    },
  });
  const base = metricsFromOrders(orders);
  const m: ExecutorMetrics = { executorId, ...base };
  m.rating = Math.round(computeExecutorRatingForSingle(m) * 10) / 10;
  m.score = m.rating;
  return m;
}

export async function getExecutorMetricsMap(
  executorIds: string[],
  options?: { organizationIds?: string[] },
): Promise<Map<string, ExecutorMetrics>> {
  if (executorIds.length === 0) return new Map();

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      status: "DONE",
      executorId: { in: executorIds },
      ...(options?.organizationIds && options.organizationIds.length > 0
        ? { organizationId: { in: options.organizationIds } }
        : {}),
    },
    select: {
      executorId: true,
      deadline: true,
      updatedAt: true,
      createdAt: true,
      profit: true,
    },
  });

  const byExec = new Map<string, typeof orders>();
  for (const o of orders) {
    if (!o.executorId) continue;
    const list = byExec.get(o.executorId) ?? [];
    list.push(o);
    byExec.set(o.executorId, list);
  }

  const map = new Map<string, ExecutorMetrics>();
  for (const id of executorIds) {
    const list = byExec.get(id) ?? [];
    const base = metricsFromOrders(list);
    map.set(id, { executorId: id, ...base });
  }
  computeExecutorRatingBatch(map);
  return map;
}

/**
 * Подбор исполнителя: active, навыки, агрегированный рейтинг (см. computeExecutorRatingBatch),
 * нормализованная прибыль и скорость по когорте.
 * Возвращает null, если нет активных исполнителей.
 */
export async function getBestExecutor(order: {
  requiredSkills: string[];
  /** Если задан — только исполнители, состоящие в этой организации. */
  organizationId?: string;
}): Promise<User | null> {
  const executors = await prisma.user.findMany({
    where: {
      role: "executor",
      status: "active",
      ...(order.organizationId
        ? { memberships: { some: { organizationId: order.organizationId } } }
        : {}),
    },
  });
  if (executors.length === 0) return null;

  const metrics = await getExecutorMetricsMap(executors.map((e) => e.id), {
    ...(order.organizationId
      ? { organizationIds: [order.organizationId] }
      : {}),
  });

  let best: User | null = null;
  let bestRank = -Infinity;

  for (const e of executors) {
    const m = metrics.get(e.id)!;
    const skill = skillMatchRatio(order.requiredSkills, e.skills);
    let profitNorm = 0;
    let speedNorm = 50;
    const profits = executors
      .map((ex) => metrics.get(ex.id)?.totalProfit ?? 0)
      .filter((p) => p > 0);
    const maxP = Math.max(...profits, 1);
    profitNorm = clamp((m.totalProfit / maxP) * 100, 0, 100);
    const avgs = executors
      .map((ex) => metrics.get(ex.id)?.avgDaysToComplete)
      .filter((x): x is number => x != null);
    if (avgs.length) {
      const minD = Math.min(...avgs);
      const maxD = Math.max(...avgs, minD + 1e-6);
      const ad = m.avgDaysToComplete ?? (minD + maxD) / 2;
      speedNorm = clamp(100 - ((ad - minD) / (maxD - minD)) * 100, 0, 100);
    }

    const rank =
      skill * 100 * 0.22 +
      m.rating * 0.48 +
      profitNorm * 0.15 +
      speedNorm * 0.15;

    if (rank > bestRank) {
      bestRank = rank;
      best = e;
    }
  }

  return best;
}
