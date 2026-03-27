import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { syncOrderStatusFromCheckpoints } from "@/lib/checkpoint-sync";
import { dispatchNotification } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

/** Завершить все чекпоинты одним запросом. Админ — любой заказ; исполнитель — только свой. */
export async function PATCH(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { checkpoints: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "executor") {
    if (order.executorId !== user.id) return forbidden();
  }

  const pending = order.checkpoints.filter((c) => c.status !== "done");
  if (pending.length === 0) {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    return NextResponse.json({
      ok: true,
      updated: 0,
      order: o ? { status: o.status } : null,
    });
  }

  for (const c of pending) {
    const before = await prisma.checkpoint.findUnique({ where: { id: c.id } });
    if (!before) continue;
    const updated = await prisma.checkpoint.update({
      where: { id: c.id },
      data: { status: "done" },
    });
    await writeAudit({
      entityType: "checkpoint",
      entityId: c.id,
      actionType:
        user.role === "executor" ? "executor_update" : "update",
      changedById: user.id,
      diff: { before, after: updated, bulk: true },
    });
  }

  await syncOrderStatusFromCheckpoints(orderId, user.id);

  const orderRow = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, title: true },
  });

  await dispatchNotification({
    key: `complete-all-${orderId}-${Date.now()}`,
    title: "Все этапы завершены",
    body: `Заказ «${order.title}» — чекпоинты закрыты, статус: ${orderRow?.status ?? "?"}`,
    audience: "admin",
    event: "checkpoints_complete_all",
  });

  return NextResponse.json({
    ok: true,
    updated: pending.length,
    order: orderRow ? { status: orderRow.status } : null,
  });
}
