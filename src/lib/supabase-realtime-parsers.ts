import { Prisma } from "@prisma/client";
import type { Checkpoint, File, Order, OrderStatus } from "@prisma/client";
import type { OrderWithRelations } from "@/lib/order-list-filters";

function asDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dec(v: unknown): Prisma.Decimal {
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(String(v ?? 0));
}

/** Строка из Realtime (postgres_changes) приходит в snake_case по именам колонок БД. */
export function parseOrderRowFromSupabase(row: Record<string, unknown>): Order | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    clientName: String(row.client_name ?? ""),
    platform: String(row.platform ?? ""),
    deadline: asDate(row.deadline),
    budgetClient: dec(row.budget_client),
    budgetExecutor: dec(row.budget_executor),
    profit: dec(row.profit),
    status: row.status as OrderStatus,
    executorId: row.executor_id != null ? String(row.executor_id) : null,
    leadId: row.lead_id != null ? String(row.lead_id) : null,
    revisionCount: Number(row.revision_count ?? 0),
    requiredSkills: Array.isArray(row.required_skills)
      ? (row.required_skills as string[])
      : [],
    templateId: row.template_id != null ? String(row.template_id) : null,
    deletedAt: asDate(row.deleted_at),
    createdAt: asDate(row.created_at) ?? new Date(),
    updatedAt: asDate(row.updated_at) ?? new Date(),
  };
}

export function parseCheckpointRowFromSupabase(row: Record<string, unknown>): Checkpoint | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    orderId: String(row.order_id ?? ""),
    title: String(row.title ?? ""),
    status: row.status as Checkpoint["status"],
    dueDate: asDate(row.due_date),
    paymentAmount: dec(row.payment_amount),
    payoutReleasedAt: asDate(row.payout_released_at),
    position: Number(row.position ?? 0),
    createdAt: asDate(row.created_at) ?? new Date(),
    updatedAt: asDate(row.updated_at) ?? new Date(),
  };
}

export function parseFileRowFromSupabase(row: Record<string, unknown>): File | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    orderId: String(row.order_id ?? ""),
    uploadedBy: row.uploaded_by as File["uploadedBy"],
    kind: (row.kind as File["kind"]) ?? "file",
    filePath: row.file_path != null ? String(row.file_path) : null,
    externalUrl: row.external_url != null ? String(row.external_url) : null,
    linkTitle: row.link_title != null ? String(row.link_title) : null,
    comment: row.comment != null ? String(row.comment) : null,
    createdAt: asDate(row.created_at) ?? new Date(),
  };
}

export function sortCheckpointsForUi(list: Checkpoint[]): Checkpoint[] {
  return [...list].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    const ta = a.dueDate?.getTime() ?? 0;
    const tb = b.dueDate?.getTime() ?? 0;
    return ta - tb;
  });
}

/**
 * Строка заказа из Realtime → элемент списка: скаляры из payload, executor из prev при том же executor_id,
 * checkpoints/files сохраняем из prev (обновляются отдельными событиями по таблицам).
 */
export function mergeOrderIntoListItem(
  row: Record<string, unknown>,
  prev: OrderWithRelations | undefined,
): OrderWithRelations | null {
  const parsed = parseOrderRowFromSupabase(row);
  if (!parsed) return null;
  const executor =
    prev && prev.executorId === parsed.executorId ? prev.executor : null;
  return {
    ...parsed,
    executor,
    checkpoints: prev?.checkpoints ?? [],
    files: prev?.files ?? [],
  };
}
