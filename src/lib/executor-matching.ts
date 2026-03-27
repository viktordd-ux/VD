import type { User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";

export type ExecutorMetrics = {
  executorId: string;
  overduePct: number;
  avgDaysToComplete: number | null;
  totalProfit: number;
  doneCount: number;
  /** 0–100, для отображения и сравнения */
  score: number;
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

function computeScoreParts(input: {
  overduePct: number;
  avgDaysToComplete: number | null;
  totalProfit: number;
}): { overduePart: number; speedPart: number; profitPart: number } {
  const overduePart = clamp(100 - input.overduePct, 0, 100);
  const speedPart =
    input.avgDaysToComplete != null
      ? clamp(100 - input.avgDaysToComplete * 2, 0, 100)
      : 50;
  const profitPart = clamp(Math.log10(input.totalProfit + 10) * 22, 0, 100);
  return { overduePart, speedPart, profitPart };
}

/** Итоговый score (0–100): среднее трёх компонент как в ТЗ. */
export function computeExecutorScoreFromParts(parts: {
  overduePart: number;
  speedPart: number;
  profitPart: number;
}): number {
  return Math.round((parts.overduePart + parts.speedPart + parts.profitPart) / 3);
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

  const parts = computeScoreParts({
    overduePct,
    avgDaysToComplete,
    totalProfit,
  });
  const score = computeExecutorScoreFromParts(parts);

  return {
    overduePct,
    avgDaysToComplete,
    totalProfit,
    doneCount: orders.length,
    score,
  };
}

/** Метрики по одному исполнителю (завершённые заказы). */
export async function getExecutorMetrics(executorId: string): Promise<ExecutorMetrics> {
  const orders = await prisma.order.findMany({
    where: { ...orderIsActive, executorId, status: "DONE" },
    select: {
      deadline: true,
      updatedAt: true,
      createdAt: true,
      profit: true,
    },
  });
  const base = metricsFromOrders(orders);
  return { executorId, ...base };
}

export async function getExecutorMetricsMap(
  executorIds: string[],
): Promise<Map<string, ExecutorMetrics>> {
  if (executorIds.length === 0) return new Map();

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      status: "DONE",
      executorId: { in: executorIds },
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
  return map;
}

/**
 * Подбор исполнителя: active, навыки, минимальная просрочка, максимальная прибыль, скорость.
 * Возвращает null, если нет активных исполнителей.
 */
export async function getBestExecutor(order: {
  requiredSkills: string[];
}): Promise<User | null> {
  const executors = await prisma.user.findMany({
    where: { role: "executor", status: "active" },
  });
  if (executors.length === 0) return null;

  const metrics = await getExecutorMetricsMap(executors.map((e) => e.id));

  let best: User | null = null;
  let bestRank = -Infinity;

  for (const e of executors) {
    const m = metrics.get(e.id)!;
    const skill = skillMatchRatio(order.requiredSkills, e.skills);
    const parts = computeScoreParts({
      overduePct: m.overduePct,
      avgDaysToComplete: m.avgDaysToComplete,
      totalProfit: m.totalProfit,
    });

    let profitNorm = parts.profitPart;
    let speedNorm = parts.speedPart;
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
      skill * 100 * 0.35 +
      (100 - m.overduePct) * 0.25 +
      profitNorm * 0.2 +
      speedNorm * 0.2;

    if (rank > bestRank) {
      bestRank = rank;
      best = e;
    }
  }

  return best;
}
