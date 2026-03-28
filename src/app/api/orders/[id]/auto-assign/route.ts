import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { writeAudit } from "@/lib/audit";
import { getBestExecutor } from "@/lib/executor-matching";
import { serializeOrder } from "@/lib/serialize";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import { notifyExecutorOrderAssigned } from "@/lib/telegram-notify";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.order.findFirst({
    where: { id, ...orderIsActive },
    include: { executor: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const best = await getBestExecutor({ requiredSkills: existing.requiredSkills });
  if (!best) {
    return NextResponse.json(
      { error: "Нет подходящих активных исполнителей" },
      { status: 400 },
    );
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { executorId: best.id },
    include: { executor: true, lead: true },
  });

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

  if (best.id !== existing.executorId) {
    notifyExecutorOrderAssigned(updated.executorId, updated.title);
  }

  revalidateOrderViews(id);
  return NextResponse.json(serializeOrder(updated, "admin"));
}
