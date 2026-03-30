import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireAdmin, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { hardDeleteOrder, softDeleteOrder } from "@/lib/deletion-ops";
import { computeProfit } from "@/lib/money";
import { dispatchNotification } from "@/lib/notifications";
import { serializeOrder } from "@/lib/serialize";
import { orderIsActive } from "@/lib/active-scope";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import {
  pushNotifyAdminsLowMargin,
  pushNotifyAdminsOrderReview,
  pushNotifyExecutorAssigned,
} from "@/lib/push-notify";
import {
  createInAppNotification,
  createInAppNotificationForAdmins,
} from "@/lib/in-app-notifications";
import { notifyExecutorOrderAssigned } from "@/lib/telegram-notify";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, ...orderIsActive },
    include: {
      executor: true,
      ...(user.role === "admin" ? { lead: true } : {}),
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  return NextResponse.json(serializeOrder(order, user.role === "admin" ? "admin" : "executor"));
}

export async function DELETE(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  try {
    if (hard) {
      await hardDeleteOrder(id, admin.id);
    } else {
      await softDeleteOrder(id, admin.id);
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }

  revalidateOrderViews(id);
  return NextResponse.json({ ok: true, hard });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await prisma.order.findFirst({
    where: { id, ...orderIsActive },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "executor") {
    if (existing.executorId !== user.id) return forbidden();
    const body = (await req.json()) as { status?: string };
    if (Object.keys(body).some((k) => k !== "status")) {
      return forbidden();
    }
    if (body.status !== "REVIEW") {
      return NextResponse.json(
        { error: "Executor may only set status to REVIEW (сдать работу)" },
        { status: 400 },
      );
    }
    if (existing.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Сдать можно только из статуса IN PROGRESS" },
        { status: 400 },
      );
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { status: "REVIEW" },
      include: { executor: true },
    });
    await writeAudit({
      entityType: "order",
      entityId: id,
      actionType: "executor_submit",
      changedById: user.id,
      diff: { before: existing, after: updated },
    });
    void dispatchNotification({
      key: `executor-submit-${id}-${Date.now()}`,
      title: "Сдача работы на проверку",
      body: `Заказ «${updated.title}» переведён в REVIEW`,
      audience: "admin",
      event: "order_submit_review",
    });
    pushNotifyAdminsOrderReview(updated.title, id);
    void createInAppNotificationForAdmins({
      kind: "order",
      title: "Сдача на проверку",
      body: `Заказ «${updated.title}» переведён в REVIEW`,
      linkHref: `/admin/orders/${id}`,
    });
    revalidateOrderViews(id);
    return NextResponse.json(serializeOrder(updated, "executor"));
  }

  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = (await req.json()) as Partial<{
    title: string;
    description: string;
    clientName: string;
    platform: string;
    deadline: string | null;
    budgetClient: number | string;
    budgetExecutor: number | string;
    status: "LEAD" | "IN_PROGRESS" | "REVIEW" | "DONE";
    executorId: string | null;
    requiredSkills: string[];
  }>;

  let revisionInc = 0;
  if (
    body.status === "IN_PROGRESS" &&
    existing.status === "REVIEW"
  ) {
    revisionInc = 1;
  }

  const budgetClient =
    body.budgetClient !== undefined
      ? Number(body.budgetClient)
      : Number(existing.budgetClient);
  const budgetExecutor =
    body.budgetExecutor !== undefined
      ? Number(body.budgetExecutor)
      : Number(existing.budgetExecutor);
  const profit = computeProfit(budgetClient, budgetExecutor);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      clientName: body.clientName ?? undefined,
      platform: body.platform ?? undefined,
      deadline:
        body.deadline === undefined
          ? undefined
          : body.deadline
            ? new Date(body.deadline)
            : null,
      budgetClient: body.budgetClient !== undefined ? budgetClient : undefined,
      budgetExecutor:
        body.budgetExecutor !== undefined ? budgetExecutor : undefined,
      profit: body.budgetClient !== undefined || body.budgetExecutor !== undefined
        ? profit
        : undefined,
      status: body.status ?? undefined,
      executorId: body.executorId !== undefined ? body.executorId : undefined,
      requiredSkills: body.requiredSkills !== undefined ? body.requiredSkills : undefined,
      revisionCount: revisionInc ? { increment: revisionInc } : undefined,
    },
    include: { executor: true, lead: true },
  });

  await writeAudit({
    entityType: "order",
    entityId: id,
    actionType: "update",
    changedById: admin.id,
    diff: { before: existing, after: updated },
  });

  if (
    body.executorId !== undefined &&
    updated.executorId &&
    updated.executorId !== existing.executorId
  ) {
    notifyExecutorOrderAssigned(updated.executorId, updated.title);
    pushNotifyExecutorAssigned(updated.executorId, updated.title, id);
    void createInAppNotification({
      userId: updated.executorId,
      kind: "order",
      title: "Вас назначили на заказ",
      body: updated.title,
      linkHref: `/executor/orders/${id}`,
    });
  }

  if (
    body.status !== undefined &&
    updated.status !== existing.status &&
    updated.executorId
  ) {
    void createInAppNotification({
      userId: updated.executorId,
      kind: "order",
      title: "Статус заказа обновлён",
      body: `«${updated.title}» — ${updated.status}`,
      linkHref: `/executor/orders/${id}`,
    });
  }

  const bc = Number(updated.budgetClient);
  if (bc > 0 && Number(updated.profit) / bc < 0.5) {
    void dispatchNotification({
      key: `low-margin-${id}-${Date.now()}`,
      title: "Низкая маржа",
      body: `Заказ «${updated.title}» — маржа ниже 50%`,
      audience: "admin",
      event: "low_margin",
    });
    pushNotifyAdminsLowMargin(updated.title, id);
  }

  revalidateOrderViews(id);
  return NextResponse.json(serializeOrder(updated, "admin"));
}
