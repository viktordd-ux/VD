import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { hardDeleteOrder, softDeleteOrder } from "@/lib/deletion-ops";
import { computeProfit } from "@/lib/money";
import { dispatchNotification } from "@/lib/notifications";
import {
  assertUsersAreOrgExecutors,
  getOrderExecutorUserIds,
  replaceOrderExecutors,
  userIsOrderExecutor,
} from "@/lib/order-executors";
import {
  canHardDeleteOrder,
  canStaffManageOrder,
  getMembership,
  getOrderAccessWhereInput,
  getSerializeOrderRoleForUser,
} from "@/lib/order-access";
import { serializeOrder } from "@/lib/serialize";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
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

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const order = await prisma.order.findFirst({
    where: { id, ...accessWhere },
    include: {
      executor: true,
      orderExecutors: { select: { userId: true } },
      lead: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const serRole = await getSerializeOrderRoleForUser(user.id, order.organizationId);
  return NextResponse.json(serializeOrder(order, serRole));
}

export async function DELETE(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const orgIds = await getAccessibleOrganizationIds(user.id);
  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  if (!(await canStaffManageOrder(user.id, id))) return forbidden();
  if (hard && !(await canHardDeleteOrder(user.id, id))) return forbidden();

  try {
    if (hard) {
      await hardDeleteOrder(id, user.id, { allowedOrganizationIds: orgIds });
    } else {
      await softDeleteOrder(id, user.id, { allowedOrganizationIds: orgIds });
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

  const accessWhere = await getOrderAccessWhereInput(user.id);

  const existing = await prisma.order.findFirst({
    where: { id, ...accessWhere },
    include: { orderExecutors: { select: { userId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await getMembership(user.id, existing.organizationId);
  const isExecutorMember =
    membership?.role === MembershipRole.EXECUTOR && userIsOrderExecutor(existing, user.id);

  if (isExecutorMember) {
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
      include: { executor: true, orderExecutors: { select: { userId: true } } },
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

  if (!(await canStaffManageOrder(user.id, id))) return forbidden();

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
    executorUserIds: string[] | null;
    requiredSkills: string[];
  }>;

  const shouldSyncExecutors =
    body.executorUserIds !== undefined || body.executorId !== undefined;

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

  const beforeExecutorIds = new Set(getOrderExecutorUserIds(existing));

  await prisma.order.update({
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
      executorId:
        shouldSyncExecutors
          ? undefined
          : body.executorId !== undefined
            ? body.executorId
            : undefined,
      requiredSkills: body.requiredSkills !== undefined ? body.requiredSkills : undefined,
      revisionCount: revisionInc ? { increment: revisionInc } : undefined,
    },
    include: { executor: true, lead: true, orderExecutors: { select: { userId: true } } },
  });

  if (shouldSyncExecutors) {
    const list =
      body.executorUserIds !== undefined
        ? body.executorUserIds ?? []
        : body.executorId
          ? [body.executorId]
          : [];
    try {
      await assertUsersAreOrgExecutors(existing.organizationId, list);
    } catch {
      return NextResponse.json(
        { error: "Недопустимые исполнители для организации" },
        { status: 400 },
      );
    }
    await replaceOrderExecutors(id, list);
  }

  const finalOrder = await prisma.order.findFirst({
    where: { id },
    include: { executor: true, lead: true, orderExecutors: { select: { userId: true } } },
  });
  if (!finalOrder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await writeAudit({
    entityType: "order",
    entityId: id,
    actionType: "update",
    changedById: user.id,
    diff: { before: existing, after: finalOrder },
  });

  const afterExecutorIds = getOrderExecutorUserIds(finalOrder);
  for (const uid of afterExecutorIds) {
    if (!beforeExecutorIds.has(uid)) {
      notifyExecutorOrderAssigned(uid, finalOrder.title);
      pushNotifyExecutorAssigned(uid, finalOrder.title, id);
      void createInAppNotification({
        userId: uid,
        kind: "order",
        title: "Вас назначили на заказ",
        body: finalOrder.title,
        linkHref: `/executor/orders/${id}`,
      });
    }
  }

  if (
    body.status !== undefined &&
    finalOrder.status !== existing.status &&
    afterExecutorIds.length > 0
  ) {
    for (const uid of afterExecutorIds) {
      void createInAppNotification({
        userId: uid,
        kind: "order",
        title: "Статус заказа обновлён",
        body: `«${finalOrder.title}» — ${finalOrder.status}`,
        linkHref: `/executor/orders/${id}`,
      });
    }
  }

  const bc = Number(finalOrder.budgetClient);
  if (bc > 0 && Number(finalOrder.profit) / bc < 0.5) {
    void dispatchNotification({
      key: `low-margin-${id}-${Date.now()}`,
      title: "Низкая маржа",
      body: `Заказ «${finalOrder.title}» — маржа ниже 50%`,
      audience: "admin",
      event: "low_margin",
    });
    pushNotifyAdminsLowMargin(finalOrder.title, id);
  }

  revalidateOrderViews(id);
  return NextResponse.json(serializeOrder(finalOrder, "admin"));
}
