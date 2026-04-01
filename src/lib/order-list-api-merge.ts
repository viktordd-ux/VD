import type { Checkpoint } from "@prisma/client";
import {
  parseAdminOrderFromApiJson,
  parseCheckpointFromApiJson,
} from "@/lib/order-client-deserialize";
import type { OrderWithRelations } from "@/lib/order-list-filters";

/** Ответ PATCH /api/orders/:id (admin) → строка списка, чекпоинты/файлы не затираем. */
export function mergeListOrderFromAdminApiJson(
  prev: OrderWithRelations,
  json: Record<string, unknown>,
): OrderWithRelations {
  const next = parseAdminOrderFromApiJson(json);
  const executor =
    next.executor && prev.executor && next.executor.id === prev.executor.id
      ? { ...prev.executor, ...next.executor }
      : next.executor;
  return {
    ...(next as unknown as OrderWithRelations),
    executor,
    checkpoints: prev.checkpoints,
    files: prev.files,
    team: (next as unknown as OrderWithRelations).team ?? prev.team,
  };
}

/** GET /api/orders/:id/checkpoints — массив из Prisma в JSON. */
export function parseCheckpointsFromListApi(json: unknown): Checkpoint[] {
  if (!Array.isArray(json)) return [];
  return json.map((x) => parseCheckpointFromApiJson(x as Record<string, unknown>));
}
