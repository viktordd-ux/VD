import { NextResponse } from "next/server";
import type { CheckpointStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { forbidden, requireAdmin, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { writeAudit } from "@/lib/audit";
import { syncOrderStatusFromCheckpoints } from "@/lib/checkpoint-sync";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import { dispatchNotification } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

function payoutFieldsOnStatusChange(
  prev: CheckpointStatus,
  next: CheckpointStatus,
): { payoutReleasedAt: Date | null } | Record<string, never> {
  if (prev !== "done" && next === "done") {
    return { payoutReleasedAt: new Date() };
  }
  if (prev === "done" && next !== "done") {
    return { payoutReleasedAt: null };
  }
  return {};
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await prisma.checkpoint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await prisma.order.findFirst({
    where: { id: existing.orderId, ...orderIsActive },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "executor") {
    if (order.executorId !== user.id) return forbidden();
    const body = (await req.json()) as { status?: CheckpointStatus };
    if (Object.keys(body).some((k) => k !== "status")) return forbidden();
    if (body.status === undefined) {
      return NextResponse.json({ error: "status required" }, { status: 400 });
    }

    if (body.status === "done") {
      return NextResponse.json(
        { error: "Принять этап может только администратор" },
        { status: 403 },
      );
    }

    if (existing.status === "done") {
      return NextResponse.json(
        { error: "Этап уже принят администратором" },
        { status: 403 },
      );
    }

    const allowed =
      (existing.status === "pending" && body.status === "awaiting_approval") ||
      (existing.status === "awaiting_approval" && body.status === "pending") ||
      existing.status === body.status;

    if (!allowed) {
      return NextResponse.json({ error: "Недопустимый переход статуса" }, { status: 400 });
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

    if (body.status === "awaiting_approval" && existing.status === "pending") {
      void dispatchNotification({
        key: `cp-submit-${id}-${Date.now()}`,
        title: "Этап сдан на проверку",
        body: `«${updated.title}» — исполнитель ждёт принятия`,
        audience: "admin",
        event: "checkpoint_done",
      });
    }

    const orderRow = await prisma.order.findUnique({
      where: { id: existing.orderId },
      select: { status: true },
    });
    revalidateOrderViews(existing.orderId);
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
    status: CheckpointStatus;
    paymentAmount: number;
  }>;

  const payoutExtra =
    body.status !== undefined && body.status !== existing.status
      ? payoutFieldsOnStatusChange(existing.status, body.status)
      : {};

  let paymentAmount: number | undefined;
  if (body.paymentAmount !== undefined) {
    const n = Number(body.paymentAmount);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "paymentAmount must be >= 0" }, { status: 400 });
    }
    paymentAmount = n;
  }

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
      paymentAmount: paymentAmount !== undefined ? paymentAmount : undefined,
      ...payoutExtra,
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
      title: "Этап принят",
      body: `«${updated.title}» — выплата по этапу зафиксирована`,
      audience: "admin",
      event: "checkpoint_done",
    });
  }

  const orderRow = await prisma.order.findUnique({
    where: { id: existing.orderId },
    select: { status: true },
  });
  revalidateOrderViews(existing.orderId);
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

  const orderOk = await prisma.order.findFirst({
    where: { id: existing.orderId, ...orderIsActive },
  });
  if (!orderOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  revalidateOrderViews(orderId);
  return NextResponse.json({ ok: true });
}
