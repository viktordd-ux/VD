import prisma from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { orderIsActive } from "@/lib/active-scope";

/**
 * Если все чекпоинты done и заказ в IN_PROGRESS → переводим в REVIEW.
 */
export async function syncOrderStatusFromCheckpoints(
  orderId: string,
  actorId: string,
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    include: { checkpoints: true },
  });
  if (!order || order.checkpoints.length === 0) return;

  const allDone = order.checkpoints.every((c) => c.status === "done");
  if (!allDone) return;
  if (order.status !== "IN_PROGRESS") return;

  const beforeStatus = order.status;
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "REVIEW" },
  });

  await writeAudit({
    entityType: "order",
    entityId: orderId,
    actionType: "auto_all_checkpoints_done",
    changedById: actorId,
    diff: {
      before: { status: beforeStatus },
      after: { status: "REVIEW" },
      reason: "all_checkpoints_done",
    },
  });
}
