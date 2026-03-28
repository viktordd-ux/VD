import { Prisma } from "@prisma/client";
import type { Checkpoint, File, Lead, Order, OrderStatus, User } from "@prisma/client";

export type OrderWithRelations = Order & {
  executor: User | null;
  lead: Lead | null;
};

function asDate(v: Date | string | null | undefined): Date | null {
  if (v == null || v === undefined) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Нормализует даты после передачи из Server Component (строки → Date). */
export function normalizeOrderForClient(o: OrderWithRelations): OrderWithRelations {
  return {
    ...o,
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
  return normalizeOrderForClient({
    ...(json as unknown as Order),
    executor: ex
      ? ({ id: ex.id, name: ex.name, email: ex.email } as User)
      : null,
    lead: lead ?? null,
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
  previous: Order,
): Order {
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
  return next;
}
