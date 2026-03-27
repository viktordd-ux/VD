import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireAdmin, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { syncOrderStatusFromCheckpoints } from "@/lib/checkpoint-sync";
import { dispatchNotification } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await prisma.checkpoint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await prisma.order.findUnique({ where: { id: existing.orderId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "executor") {
    if (order.executorId !== user.id) return forbidden();
    const body = (await req.json()) as { status?: "pending" | "done" };
    if (Object.keys(body).some((k) => k !== "status")) return forbidden();
    if (!body.status) {
      return NextResponse.json({ error: "status required" }, { status: 400 });
    }
    const updated = await prisma.checkpoint.update({
      where: { id },
      data: { status: body.status },
    });
    await writeAudit({
      entityType: "checkpoint",
      entityId: id,
      actionType: "executor_update",
      changedById: user.id,
      diff: { before: existing, after: updated },
    });
    await syncOrderStatusFromCheckpoints(existing.orderId, user.id);
    if (body.status === "done" && existing.status !== "done") {
      void dispatchNotification({
        key: `cp-done-${id}-${Date.now()}`,
        title: "Чекпоинт выполнен",
        body: `Этап «${updated.title}» (исполнитель)`,
        audience: "admin",
        event: "checkpoint_done",
      });
    }
    const orderRow = await prisma.order.findUnique({
      where: { id: existing.orderId },
      select: { status: true },
    });
    return NextResponse.json({
      checkpoint: updated,
      order: orderRow ? { status: orderRow.status } : null,
    });
  }

  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = (await req.json()) as Partial<{
    title: string;
    dueDate: string | null;
    status: "pending" | "done";
  }>;

  const updated = await prisma.checkpoint.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      dueDate:
        body.dueDate === undefined
          ? undefined
          : body.dueDate
            ? new Date(body.dueDate)
            : null,
      status: body.status ?? undefined,
    },
  });

  await writeAudit({
    entityType: "checkpoint",
    entityId: id,
    actionType: "update",
    changedById: admin.id,
    diff: { before: existing, after: updated },
  });

  await syncOrderStatusFromCheckpoints(existing.orderId, admin.id);

  if (body.status === "done" && existing.status !== "done") {
    void dispatchNotification({
      key: `cp-done-admin-${id}-${Date.now()}`,
      title: "Чекпоинт выполнен",
      body: `Этап «${updated.title}» (админ)`,
      audience: "admin",
      event: "checkpoint_done",
    });
  }

  const orderRow = await prisma.order.findUnique({
    where: { id: existing.orderId },
    select: { status: true },
  });
  return NextResponse.json({
    checkpoint: updated,
    order: orderRow ? { status: orderRow.status } : null,
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.checkpoint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orderId = existing.orderId;
  await prisma.checkpoint.delete({ where: { id } });

  await writeAudit({
    entityType: "checkpoint",
    entityId: id,
    actionType: "delete",
    changedById: admin.id,
    diff: { before: existing },
  });

  await syncOrderStatusFromCheckpoints(orderId, admin.id);

  return NextResponse.json({ ok: true });
}
