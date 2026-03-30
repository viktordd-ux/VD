import type { Order, Checkpoint } from "@prisma/client";

export type OrderPriorityLevel = "low" | "medium" | "high";

const STALE_DAYS_MEDIUM = 5;

/**
 * Вычисляемый приоритет (без отдельного поля в БД):
 * - high: просрочен дедлайн при активном заказе
 * - medium: давно не было обновления (updatedAt)
 * - low: остальное
 */
export function computeOrderPriority(
  order: Pick<Order, "status" | "deadline" | "updatedAt">,
  checkpoints: Pick<Checkpoint, "status" | "dueDate">[],
): OrderPriorityLevel {
  const now = Date.now();
  if (order.status !== "DONE" && order.deadline) {
    const d = order.deadline.getTime();
    if (d < now) return "high";
  }
  const cpOverdue = checkpoints.some(
    (c) =>
      c.status !== "done" &&
      c.dueDate != null &&
      c.dueDate.getTime() < now,
  );
  if (cpOverdue && order.status !== "DONE") return "high";

  const staleMs = now - order.updatedAt.getTime();
  if (staleMs > STALE_DAYS_MEDIUM * 24 * 60 * 60 * 1000 && order.status !== "DONE") {
    return "medium";
  }
  return "low";
}

export const orderPriorityLabel: Record<OrderPriorityLevel, string> = {
  low: "Обычный",
  medium: "Внимание",
  high: "Срочно",
};
