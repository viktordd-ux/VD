import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getUnreadFlagsForOrders } from "@/lib/order-unread-state";

type Params = { params: Promise<{ id: string }> };

/** Один запрос для карточки заказа (админ): заказ, файлы, чекпоинты, исполнители, метрики, unread. */
export async function GET(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, ...orderIsActive },
    include: { executor: true, lead: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [files, checkpoints, executors] = await Promise.all([
    prisma.file.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.checkpoint.findMany({
      where: { orderId: id },
      orderBy: [{ position: "asc" }, { dueDate: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "executor", status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, skills: true },
    }),
  ]);

  const metrics = await getExecutorMetricsMap(executors.map((e) => e.id));
  const executorStats = Object.fromEntries(
    [...metrics.entries()].map(([eid, m]) => [
      eid,
      {
        rating: m.rating,
        completedOrders: m.completedOrders,
        latePercent: m.latePercent,
      },
    ]),
  );

  let initialChatUnread = false;
  const unreadMap = await getUnreadFlagsForOrders(admin.id, [id]);
  initialChatUnread = unreadMap.get(id)?.hasUnreadChat ?? false;

  return NextResponse.json({
    order,
    files,
    checkpoints,
    executors,
    executorStats,
    initialChatUnread,
  });
}
