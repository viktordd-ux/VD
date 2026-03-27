import type { Checkpoint, File, Order } from "@prisma/client";
import { getSilenceThresholds } from "@/lib/silence-config";

export type OrderRiskFlags = {
  redRevisions: boolean;
  redDeadline: boolean;
  yellowCheckpoint: boolean;
  /** Предупреждение: нет активности дольше порога SILENCE_WARNING_DAYS */
  yellowSilent: boolean;
  /** Высокий риск: нет активности дольше SILENCE_HIGH_DAYS */
  redSilent: boolean;
};

export function getOrderRiskFlags(
  order: Order,
  checkpoints: Pick<Checkpoint, "status" | "dueDate">[],
  files: Pick<File, "uploadedBy" | "createdAt">[],
): OrderRiskFlags {
  const now = new Date();
  const { warningDays, highDays } = getSilenceThresholds();
  const warningMs = warningDays * 24 * 60 * 60 * 1000;
  const highMs = highDays * 24 * 60 * 60 * 1000;

  const redRevisions = order.revisionCount > 2;
  const redDeadline = Boolean(
    order.deadline && order.deadline < now && order.status !== "DONE",
  );

  const yellowCheckpoint = checkpoints.some(
    (c) =>
      c.status === "pending" &&
      c.dueDate &&
      c.dueDate < now &&
      order.status !== "DONE",
  );

  const execFiles = files.filter((f) => f.uploadedBy === "executor");
  const lastExecTs = execFiles.length
    ? Math.max(...execFiles.map((f) => f.createdAt.getTime()))
    : 0;

  let yellowSilent = false;
  let redSilent = false;

  if (
    order.status === "IN_PROGRESS" &&
    Boolean(order.executorId) &&
    !redDeadline &&
    !redRevisions
  ) {
    if (lastExecTs === 0) {
      const age = Date.now() - order.createdAt.getTime();
      redSilent = age >= highMs;
      yellowSilent = age >= warningMs && age < highMs;
    } else {
      const silence = Date.now() - lastExecTs;
      redSilent = silence >= highMs;
      yellowSilent = silence >= warningMs && silence < highMs;
    }
  }

  return {
    redRevisions,
    redDeadline,
    yellowCheckpoint,
    yellowSilent,
    redSilent,
  };
}

export function hasAnyYellow(f: OrderRiskFlags): boolean {
  return f.yellowCheckpoint || f.yellowSilent;
}

export function hasAnyRed(f: OrderRiskFlags): boolean {
  return f.redRevisions || f.redDeadline || f.redSilent;
}
