import type { Lead, Order, User } from "@prisma/client";

type OrderWithRelations = Order & {
  executor: User | null;
  lead?: Lead | null;
};

export function serializeOrder(
  order: OrderWithRelations,
  role: "admin" | "executor",
): Record<string, unknown> {
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
  };
}
