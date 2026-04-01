import type { Lead, Order, User } from "@prisma/client";
import { getOrderExecutorUserIds } from "@/lib/order-executors";

type OrderWithRelations = Order & {
  executor: User | null;
  lead?: Lead | null;
  orderExecutors?: { userId: string }[];
};

export function serializeOrder(
  order: OrderWithRelations,
  role: "admin" | "executor",
): Record<string, unknown> {
  const executorUserIds = getOrderExecutorUserIds(order);

  if (role === "admin") {
    return {
      id: order.id,
      title: order.title,
      description: order.description,
      clientName: order.clientName,
      platform: order.platform,
      deadline: order.deadline,
      budgetClient: order.budgetClient.toString(),
      budgetExecutor: order.budgetExecutor.toString(),
      profit: order.profit.toString(),
      status: order.status,
      organizationId: order.organizationId,
      teamId: order.teamId,
      executorId: order.executorId,
      leadId: order.leadId,
      revisionCount: order.revisionCount,
      requiredSkills: order.requiredSkills,
      templateId: order.templateId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      executor: order.executor
        ? { id: order.executor.id, name: order.executor.name, email: order.executor.email }
        : null,
      lead: order.lead ?? null,
      executorUserIds,
    };
  }

  const executor =
    order.executorId && order.executor
      ? { id: order.executor.id, name: order.executor.name }
      : null;

  return {
    id: order.id,
    title: order.title,
    description: order.description,
    platform: order.platform,
    deadline: order.deadline,
    status: order.status,
    executorId: order.executorId,
    executor,
    revisionCount: order.revisionCount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    executorUserIds,
  };
}
