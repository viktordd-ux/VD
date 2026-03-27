import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireAdmin, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { syncOrderStatusFromCheckpoints } from "@/lib/checkpoint-sync";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  const checkpoints = await prisma.checkpoint.findMany({
    where: { orderId },
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
  });
  return NextResponse.json(checkpoints);
}

export async function POST(req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const body = (await req.json()) as {
    title?: string;
    dueDate?: string | null;
    status?: "pending" | "done";
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

  return NextResponse.json(cp);
}
