import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/api-auth";
import { canStaffManageOrder, getOrderAccessWhereInput } from "@/lib/order-access";
import { writeAudit } from "@/lib/audit";
import { getBestExecutor } from "@/lib/executor-matching";
import { getOrderExecutorUserIds, replaceOrderExecutors } from "@/lib/order-executors";
import { serializeOrder } from "@/lib/serialize";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import { pushNotifyExecutorAssigned } from "@/lib/push-notify";
import { notifyExecutorOrderAssigned } from "@/lib/telegram-notify";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const admin = await requireStaff();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  if (!(await canStaffManageOrder(admin.id, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessWhere = await getOrderAccessWhereInput(admin.id);
  const existing = await prisma.order.findFirst({
    where: { id, ...accessWhere },
    include: { executor: true, orderExecutors: { select: { userId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const best = await getBestExecutor({
    requiredSkills: existing.requiredSkills,
    organizationId: existing.organizationId,
  });
  if (!best) {
    return NextResponse.json(
      { error: "Нет подходящих активных исполнителей" },
      { status: 400 },
    );
  }

  const beforeIds = new Set(getOrderExecutorUserIds(existing));
  await replaceOrderExecutors(id, [best.id]);

  const updated = await prisma.order.findFirst({
    where: { id },
    include: { executor: true, lead: true, orderExecutors: { select: { userId: true } } },
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await writeAudit({
    entityType: "order",
    entityId: id,
    actionType: "auto_assign_executor",
    changedById: admin.id,
    diff: {
      before: { executorId: existing.executorId },
      after: { executorId: best.id },
    },
  });

  if (!beforeIds.has(best.id)) {
    notifyExecutorOrderAssigned(updated.executorId, updated.title);
    pushNotifyExecutorAssigned(updated.executorId, updated.title, id);
  }

  revalidateOrderViews(id);
  return NextResponse.json(serializeOrder(updated, "admin"));
}
