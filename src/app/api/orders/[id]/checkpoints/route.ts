import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { getOrderExecutorUserIds } from "@/lib/order-executors";
import { canStaffManageOrder, getOrderAccessWhereInput } from "@/lib/order-access";
import { writeAudit } from "@/lib/audit";
import { syncOrderStatusFromCheckpoints } from "@/lib/checkpoint-sync";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import { pushNotifyExecutorNewCheckpoint } from "@/lib/push-notify";
import { notifyExecutorNewCheckpoint } from "@/lib/telegram-notify";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...accessWhere },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const checkpoints = await prisma.checkpoint.findMany({
    where: { orderId },
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
  });
  return NextResponse.json(checkpoints);
}

export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  if (!(await canStaffManageOrder(user.id, orderId))) return forbidden();

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const orderOk = await prisma.order.findFirst({
    where: { id: orderId, ...accessWhere },
    include: { orderExecutors: { select: { userId: true } } },
  });
  if (!orderOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    title?: string;
    dueDate?: string | null;
    status?: "pending" | "awaiting_approval" | "done";
  };
  if (!body.title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const agg = await prisma.checkpoint.aggregate({
    where: { orderId },
    _max: { position: true },
  });
  const nextPos = (agg._max.position ?? -1) + 1;

  const cp = await prisma.checkpoint.create({
    data: {
      orderId,
      title: body.title,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status ?? "pending",
      position: nextPos,
    },
  });

  await writeAudit({
    entityType: "checkpoint",
    entityId: cp.id,
    actionType: "create",
    changedById: user.id,
    diff: { orderId, checkpoint: cp },
  });

  await syncOrderStatusFromCheckpoints(orderId, user.id);

  for (const uid of getOrderExecutorUserIds(orderOk)) {
    notifyExecutorNewCheckpoint(uid, orderOk.title);
    pushNotifyExecutorNewCheckpoint(uid, orderOk.title, orderId);
  }

  revalidateOrderViews(orderId);
  return NextResponse.json(cp);
}
