import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { AdminCompleteAllCheckpoints } from "@/components/admin-complete-all-checkpoints";
import { AdminCheckpointsPanel } from "@/components/admin-checkpoints-panel";
import { AdminOrderProvider } from "@/components/admin-order/admin-order-context";
import { AdminOrderRealtime } from "@/components/admin-order/admin-order-realtime";
import { AdminOrderFilesSection } from "@/components/admin-order/admin-order-files-section";
import { AdminOrderHistoryTabs } from "@/components/admin-order/admin-order-history-tabs";
import { AdminOrderSummaryCard } from "@/components/admin-order/admin-order-summary-card";
import { Card } from "@/components/ui/card";
import { AdminOrderDelete } from "./admin-order-delete";
import { OrderChat } from "@/components/order-chat/order-chat";
import { AdminOrderForm } from "./ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderPage({ params }: Props) {
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, ...orderIsActive },
    include: { executor: true, lead: true },
  });
  if (!order) notFound();

  const executors = await prisma.user.findMany({
    where: { role: "executor", status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, skills: true },
  });
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

  const files = await prisma.file.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "desc" },
  });

  const checkpoints = await prisma.checkpoint.findMany({
    where: { orderId: id },
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
  });

  return (
    <AdminOrderProvider
      initialOrder={order}
      initialCheckpoints={checkpoints}
      initialFiles={files}
    >
      <AdminOrderRealtime orderId={id} />
      <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
        <Link
          href="/admin/orders"
          className="inline-flex min-h-11 items-center text-base text-zinc-500 hover:text-zinc-800 md:min-h-0 md:text-sm"
        >
          ← К списку заказов
        </Link>

        <AdminOrderSummaryCard />

        <OrderChat orderId={id} />

        <AdminOrderForm executors={executors} executorStats={executorStats} />

        <Card className="p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Этапы</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Когда все этапы выполнены при статусе «В работе», заказ переходит на проверку.
              </p>
            </div>
            <AdminCompleteAllCheckpoints orderId={id} />
          </div>
          <div className="mt-4">
            <AdminCheckpointsPanel orderId={id} />
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <AdminOrderFilesSection orderId={id} />
        </Card>

        <AdminOrderDelete orderId={id} />

        <Card className="p-4 md:p-6">
          <h2 className="text-base font-semibold text-zinc-900">История и аудит</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Хронология изменений, этапов и записей аудита по заказу.
          </p>
          <div className="mt-4">
            <AdminOrderHistoryTabs orderId={id} />
          </div>
        </Card>
      </div>
    </AdminOrderProvider>
  );
}
