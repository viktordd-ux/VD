import { Prisma } from "@prisma/client";
import type { Checkpoint, File, Lead, Order, OrderStatus, User } from "@prisma/client";
import { getOrderExecutorUserIds } from "@/lib/order-executors";

/** Команда заказа (с members — для участников в UI). */
export type OrderTeamClient = {
  id: string;
  name: string;
  members?: {
    userId: string;
    user?: Pick<User, "id" | "name" | "email"> | null;
  }[];
} | null;

export type OrderWithRelations = Order & {
  executor: User | null;
  lead: Lead | null;
  /** Назначенные исполнители (ids), в т.ч. co-executors. */
  executorUserIds?: string[];
  team?: OrderTeamClient;
};

function asDate(v: Date | string | null | undefined): Date | null {
  if (v == null || v === undefined) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Нормализует даты после передачи из Server Component (строки → Date). */
export function normalizeOrderForClient(
  o: OrderWithRelations & { orderExecutors?: { userId: string }[] },
): OrderWithRelations {
  const { orderExecutors, ...rest } = o;
  const executorUserIds =
    o.executorUserIds ??
    (orderExecutors?.length
      ? getOrderExecutorUserIds({ executorId: o.executorId, orderExecutors })
      : undefined);
  return {
    ...rest,
    ...(executorUserIds ? { executorUserIds } : {}),
    deadline: asDate(o.deadline),
    createdAt: asDate(o.createdAt) ?? o.createdAt,
    updatedAt: asDate(o.updatedAt) ?? o.updatedAt,
    budgetClient:
      o.budgetClient instanceof Prisma.Decimal
        ? o.budgetClient
        : new Prisma.Decimal(String(o.budgetClient)),
    budgetExecutor:
      o.budgetExecutor instanceof Prisma.Decimal
        ? o.budgetExecutor
        : new Prisma.Decimal(String(o.budgetExecutor)),
    profit:
      o.profit instanceof Prisma.Decimal ? o.profit : new Prisma.Decimal(String(o.profit)),
    lead: o.lead
      ? {
          ...o.lead,
          createdAt: asDate(o.lead.createdAt) ?? o.lead.createdAt,
          updatedAt: asDate(o.lead.updatedAt) ?? o.lead.updatedAt,
        }
      : null,
  };
}

/** Ответ PATCH /api/orders/:id (admin, serializeOrder). */
export function parseAdminOrderFromApiJson(json: Record<string, unknown>): OrderWithRelations {
  const ex = json.executor as { id: string; name: string; email: string } | null | undefined;
  const lead = json.lead as Lead | null | undefined;
  const executorUserIds = Array.isArray(json.executorUserIds)
    ? (json.executorUserIds as unknown[]).map(String)
    : undefined;
  return normalizeOrderForClient({
    ...(json as unknown as Order),
    executor: ex
      ? ({ id: ex.id, name: ex.name, email: ex.email } as User)
      : null,
    lead: lead ?? null,
    ...(executorUserIds ? { executorUserIds } : {}),
  } as OrderWithRelations);
}

export function parseCheckpointFromApiJson(json: Record<string, unknown>): Checkpoint {
  return {
    ...(json as unknown as Checkpoint),
    dueDate: asDate(json.dueDate as string | Date | null),
    payoutReleasedAt: asDate(json.payoutReleasedAt as string | Date | null),
    createdAt: asDate(json.createdAt as string | Date) ?? new Date(),
    updatedAt: asDate(json.updatedAt as string | Date) ?? new Date(),
    paymentAmount:
      json.paymentAmount instanceof Prisma.Decimal
        ? json.paymentAmount
        : new Prisma.Decimal(String(json.paymentAmount ?? 0)),
  };
}

export function parseFileFromApiJson(json: Record<string, unknown>): File {
  return {
    ...(json as unknown as File),
    createdAt: asDate(json.createdAt as string | Date) ?? new Date(),
  };
}

/** Ответ PATCH /api/orders/:id (исполнитель — в JSON только часть полей). */
export function parseExecutorOrderFromApiJson(
  json: Record<string, unknown>,
  previous: Order & { executorUserIds?: string[] },
): Order & { executorUserIds?: string[] } {
  const next = { ...previous };
  if (json.status !== undefined) next.status = json.status as OrderStatus;
  if (json.title !== undefined) next.title = String(json.title);
  if (json.description !== undefined) next.description = String(json.description);
  if (json.platform !== undefined) next.platform = String(json.platform);
  if (json.deadline !== undefined) next.deadline = asDate(json.deadline as string | Date | null);
  if (json.revisionCount !== undefined) next.revisionCount = Number(json.revisionCount);
  if (json.updatedAt !== undefined) {
    next.updatedAt = asDate(json.updatedAt as string | Date) ?? next.updatedAt;
  }
  if (json.executorId !== undefined) {
    next.executorId = json.executorId ? String(json.executorId) : null;
  }
  if (Array.isArray(json.executorUserIds)) {
    next.executorUserIds = (json.executorUserIds as unknown[]).map(String);
  }
  return next;
}
