import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { getOrderExecutorUserIds } from "@/lib/order-executors";
import {
  canStaffManageOrder,
  getMembership,
  getOrderAccessWhereInput,
} from "@/lib/order-access";
import { writeAudit } from "@/lib/audit";
import { syncOrderStatusFromCheckpoints } from "@/lib/checkpoint-sync";
import { dispatchNotification } from "@/lib/notifications";
import {
  pushNotifyAdminsCheckpointsBulk,
  pushNotifyExecutorCheckpointsBulkAccepted,
} from "@/lib/push-notify";
import { revalidateOrderViews } from "@/lib/revalidate-app";

type Params = { params: Promise<{ id: string }> };

/** Завершить этапы массово: исполнитель — сдаёт все на проверку; руководство — принимает все (done + выплата). */
export async function PATCH(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...accessWhere },
    include: {
      checkpoints: true,
      orderExecutors: { select: { userId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const m = await getMembership(user.id, order.organizationId);
  const ids = getOrderExecutorUserIds(order);
  const isExecutorMember =
    m?.role === MembershipRole.EXECUTOR && ids.includes(user.id);
  const isStaffOp = await canStaffManageOrder(user.id, orderId);

  if (!isStaffOp && !isExecutorMember) return forbidden();

  const pending = order.checkpoints.filter((c) =>
    isStaffOp ? c.status !== "done" : c.status === "pending",
  );

  if (pending.length === 0) {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    revalidateOrderViews(orderId);
    return NextResponse.json({
      ok: true,
      updated: 0,
      order: o ? { status: o.status } : null,
    });
  }

  let updated = 0;
  for (const c of pending) {
    const before = await prisma.checkpoint.findUnique({ where: { id: c.id } });
    if (!before) continue;

    const data = isStaffOp
      ? {
          status: "done" as const,
          payoutReleasedAt: before.payoutReleasedAt ?? new Date(),
        }
      : { status: "awaiting_approval" as const };

    const next = await prisma.checkpoint.update({
      where: { id: c.id },
      data,
    });
    await writeAudit({
      entityType: "checkpoint",
      entityId: c.id,
      actionType: isExecutorMember ? "executor_update" : "update",
      changedById: user.id,
      diff: { before, after: next, bulk: true },
    });
    updated++;
  }

  await syncOrderStatusFromCheckpoints(orderId, user.id);

  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, title: true },
  });

  await dispatchNotification({
    key: `complete-all-${orderId}-${Date.now()}`,
    title: isStaffOp ? "Все этапы приняты" : "Этапы сданы на проверку",
    body: `Заказ «${order.title}» — ${updated} этап(ов). Статус: ${orderRow?.status ?? "?"}`,
    audience: "admin",
    event: "checkpoints_complete_all",
  });

  if (updated > 0) {
    if (!isStaffOp) {
      pushNotifyAdminsCheckpointsBulk(order.title, orderId, updated);
    } else {
      for (const uid of getOrderExecutorUserIds(order)) {
        pushNotifyExecutorCheckpointsBulkAccepted(uid, order.title, orderId);
      }
    }
  }

  revalidateOrderViews(orderId);
  return NextResponse.json({
    ok: true,
    updated,
    order: orderRow ? { status: orderRow.status } : null,
  });
}
