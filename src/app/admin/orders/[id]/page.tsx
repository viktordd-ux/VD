import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getOrderRiskFlags } from "@/lib/order-risk";
import { AdminCompleteAllCheckpoints } from "@/components/admin-complete-all-checkpoints";
import { AdminCheckpointsPanel } from "@/components/admin-checkpoints-panel";
import { OrderHistoryTabs } from "@/components/order-history-tabs";
import { OrderRiskBadges } from "@/components/order-risk-badges";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Card } from "@/components/ui/card";
import { AdminOrderDelete } from "./admin-order-delete";
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
  const executorScores = Object.fromEntries(
    [...metrics.entries()].map(([eid, m]) => [eid, m.score]),
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

  const marginPct =
    Number(order.budgetClient) > 0
      ? Math.round(
          (Number(order.profit) / Number(order.budgetClient)) * 100,
        )
      : null;

  const deadlineLabel = order.deadline
    ? order.deadline.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Не задан";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/admin/orders"
        className="inline-flex text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← К списку заказов
      </Link>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {order.title}
            </h1>
            <OrderRiskBadges flags={riskFlags} />
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <dl className="mt-6 grid gap-4 border-t border-zinc-100 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Исполнитель
            </dt>
            <dd className="mt-1 text-sm font-medium text-zinc-900">
              {order.executor?.name ?? "Не назначен"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Дедлайн
            </dt>
            <dd className="mt-1 text-sm tabular-nums text-zinc-900">{deadlineLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Маржа
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-emerald-800">
              {marginPct !== null ? `${marginPct}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Прибыль
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
              {order.profit.toString()}
            </dd>
          </div>
        </dl>
      </Card>

      <AdminOrderForm
        order={order}
        executors={executors}
        executorScores={executorScores}
      />

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Этапы</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Когда все этапы выполнены при статусе «В работе», заказ переходит на проверку.
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
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Файлы</h2>
          {files.length > 0 && (
            <a
              href={`/api/orders/${id}/files/archive`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Скачать архив (ZIP)
            </a>
          )}
        </div>
        <ul className="mt-4 space-y-2 text-sm">
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
          {files.length === 0 && (
            <li className="text-zinc-500">Файлов пока нет — загрузите их со стороны исполнителя.</li>
          )}
        </ul>
      </Card>

      <AdminOrderDelete orderId={id} />

      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-900">История и аудит</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Хронология изменений, этапов и записей аудита по заказу.
        </p>
        <div className="mt-4">
          <OrderHistoryTabs orderId={id} />
        </div>
      </Card>
    </div>
  );
}
