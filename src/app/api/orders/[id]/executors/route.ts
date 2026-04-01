import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import {
  assertUsersAreOrgExecutors,
  getOrderExecutorUserIds,
  replaceOrderExecutors,
} from "@/lib/order-executors";
import { orderIsActive } from "@/lib/active-scope";
import { canStaffManageOrder, getOrderAccessWhereInput } from "@/lib/order-access";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import {
  pushNotifyExecutorAssigned,
} from "@/lib/push-notify";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { notifyExecutorOrderAssigned } from "@/lib/telegram-notify";

type Params = { params: Promise<{ id: string }> };

/** PATCH — добавить / снять исполнителей: { add?: string[], remove?: string[] } */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  if (!(await canStaffManageOrder(user.id, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const order = await prisma.order.findFirst({
    where: { id, ...orderIsActive, ...accessWhere },
    include: { orderExecutors: { select: { userId: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { add?: string[]; remove?: string[] };
  const add = Array.isArray(body.add) ? body.add : [];
  const remove = Array.isArray(body.remove) ? body.remove : [];

  const cur = getOrderExecutorUserIds(order);
  const removeSet = new Set(remove.map((x) => x.trim()).filter(Boolean));
  let next = cur.filter((uid) => !removeSet.has(uid));
  for (const uid of add) {
    const t = uid.trim();
    if (t && !next.includes(t)) next.push(t);
  }

  try {
    await assertUsersAreOrgExecutors(order.organizationId, next);
  } catch {
    return NextResponse.json(
      { error: "Недопустимые исполнители для организации" },
      { status: 400 },
    );
  }

  const beforeIds = new Set(cur);
  await replaceOrderExecutors(id, next);

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
    actionType: "order_executors_update",
    changedById: user.id,
    diff: { before: { executorUserIds: [...beforeIds] }, after: { executorUserIds: next } },
  });

  const afterIds = getOrderExecutorUserIds(finalOrder);
  for (const uid of afterIds) {
    if (!beforeIds.has(uid)) {
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

  revalidateOrderViews(id);
  return NextResponse.json({
    ok: true,
    executorUserIds: afterIds,
    executorId: finalOrder.executorId,
  });
}
