import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getOrderRiskFlags } from "@/lib/order-risk";
import { AdminCompleteAllCheckpoints } from "@/components/admin-complete-all-checkpoints";
import { AdminCheckpointsPanel } from "@/components/admin-checkpoints-panel";
import { OrderHistoryTabs } from "@/components/order-history-tabs";
import { OrderRiskBadges } from "@/components/order-risk-badges";
import { AdminOrderForm } from "./ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderPage({ params }: Props) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { executor: true, lead: true },
  });
  if (!order) notFound();

  const executors = await prisma.user.findMany({
    where: { role: "executor", status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, skills: true },
  });
  const metrics = await getExecutorMetricsMap(executors.map((e) => e.id));
  const executorScores = Object.fromEntries(
    [...metrics.entries()].map(([id, m]) => [id, m.score]),
  );

  const files = await prisma.file.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "desc" },
  });

  const checkpoints = await prisma.checkpoint.findMany({
    where: { orderId: id },
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
  });

  const riskFlags = getOrderRiskFlags(order, checkpoints, files);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/admin/orders" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← К заказам
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{order.title}</h1>
        <OrderRiskBadges flags={riskFlags} />
      </div>

      <AdminOrderForm
        order={order}
        executors={executors}
        executorScores={executorScores}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase text-zinc-500">Чекпоинты</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Все этапы done при активном заказе в IN PROGRESS переводят заказ в REVIEW.
            </p>
          </div>
          <AdminCompleteAllCheckpoints
            orderId={id}
            hasCheckpoints={checkpoints.length > 0}
          />
        </div>
        <div className="mt-4">
          <AdminCheckpointsPanel orderId={id} initial={checkpoints} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase text-zinc-500">Файлы</h2>
          {files.length > 0 && (
            <a
              href={`/api/orders/${id}/files/archive`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Скачать все (ZIP)
            </a>
          )}
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {files.map((f) => (
            <li key={f.id}>
              <a
                href={`/api/files/${f.id}`}
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {f.filePath.split("/").pop()}
              </a>
              {f.comment ? <span className="text-zinc-500"> — {f.comment}</span> : null}
            </li>
          ))}
          {files.length === 0 && <li className="text-zinc-500">Нет файлов</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">История изменений</h2>
        <div className="mt-3">
          <OrderHistoryTabs orderId={id} />
        </div>
      </section>
    </div>
  );
}
