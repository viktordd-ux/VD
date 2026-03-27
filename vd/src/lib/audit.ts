import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function writeAudit(params: {
  entityType: string;
  entityId: string;
  actionType: string;
  changedById: string;
  diff?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      actionType: params.actionType,
      changedById: params.changedById,
      diff: params.diff ?? undefined,
    },
  });
}
