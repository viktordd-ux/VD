import type { Checkpoint, File } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  normalizeOrderForClient,
  type OrderWithRelations,
} from "@/lib/order-client-deserialize";

/** Ответ GET /api/admin/orders/:id/bundle после JSON (строки дат / Decimal). */
export function hydrateOrderBundleFromApi(raw: {
  order: Record<string, unknown>;
  checkpoints: Record<string, unknown>[];
  files: Record<string, unknown>[];
}): {
  order: OrderWithRelations;
  checkpoints: Checkpoint[];
  files: File[];
} {
  const order = normalizeOrderForClient(raw.order as OrderWithRelations);
  const checkpoints = raw.checkpoints.map(
    (c) =>
      ({
        ...c,
        paymentAmount: new Prisma.Decimal(String(c.paymentAmount ?? 0)),
        dueDate: c.dueDate ? new Date(String(c.dueDate)) : null,
        payoutReleasedAt: c.payoutReleasedAt
          ? new Date(String(c.payoutReleasedAt))
          : null,
        createdAt: new Date(String(c.createdAt)),
        updatedAt: new Date(String(c.updatedAt)),
      }) as Checkpoint,
  );
  const files = raw.files.map(
    (f) =>
      ({
        ...f,
        createdAt: new Date(String(f.createdAt)),
      }) as File,
  );
  return { order, checkpoints, files };
}
