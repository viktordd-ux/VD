import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getUnreadFlagsForOrders } from "@/lib/order-unread-state";
import { getOrderAccessWhereInput } from "@/lib/order-access";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";

type Params = { params: Promise<{ id: string }> };

/** Один запрос для карточки заказа (админ): заказ, файлы, чекпоинты, исполнители, метрики, unread. */
export async function GET(_req: Request, { params }: Params) {
  const admin = await requireUser();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const orgIds = await getAccessibleOrganizationIds(admin.id);
  const accessWhere = await getOrderAccessWhereInput(admin.id);
  const order = await prisma.order.findFirst({
    where: { id, ...accessWhere },
    include: {
      executor: true,
      lead: true,
      orderExecutors: { select: { userId: true } },
      team: {
        include: {
          members: {
            select: {
              userId: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
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
      where: {
        role: "executor",
        status: "active",
        memberships: { some: { organizationId: order.organizationId } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, skills: true },
    }),
  ]);

  const metrics = await getExecutorMetricsMap(executors.map((e) => e.id), {
    organizationIds: [order.organizationId],
  });
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
