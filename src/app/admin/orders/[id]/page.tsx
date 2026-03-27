import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getOrderRiskFlags } from "@/lib/order-risk";
import { AdminCompleteAllCheckpoints } from "@/components/admin-complete-all-checkpoints";
import { AdminCheckpointsPanel } from "@/components/admin-checkpoints-panel";
import { AdminFileUpload } from "@/components/admin-file-upload";
import { OrderHistoryTabs } from "@/components/order-history-tabs";
import { OrderRiskBadges } from "@/components/order-risk-badges";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Card } from "@/components/ui/card";
import { displayFileEntryLabel } from "@/lib/uploads";
import { OrderLiveRefresh } from "@/components/order-live-refresh";
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
    <div className="mx-auto max-w-3xl space-y-6 md:space-y-8">
      <OrderLiveRefresh />
      <Link
        href="/admin/orders"
        className="inline-flex min-h-11 items-center text-base text-zinc-500 hover:text-zinc-800 md:min-h-0 md:text-sm"
      >
        ← К списку заказов
      </Link>

      <Card className="p-4 shadow-md shadow-slate-950/[0.06] md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-xl font-semibold leading-snug tracking-tight text-zinc-900 md:text-2xl">
              {order.title}
            </h1>
            <OrderRiskBadges flags={riskFlags} />
          </div>
          <div className="shrink-0 self-start">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
        <dl className="mt-6 space-y-4 border-t border-zinc-100 pt-6 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
          <div className="order-1 sm:order-none">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Исполнитель
            </dt>
            <dd className="mt-1 text-base font-medium leading-relaxed text-zinc-900 md:text-sm">
              {order.executor?.name ?? "Не назначен"}
            </dd>
          </div>
          <div className="order-2 sm:order-none">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Дедлайн
            </dt>
            <dd className="mt-1 text-base tabular-nums leading-relaxed text-zinc-900 md:text-sm">
              {deadlineLabel}
            </dd>
          </div>
          <div className="order-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 sm:order-none sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Финансы
            </dt>
            <dd className="mt-2">
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-baseline sm:gap-8">
                <div>
                  <span className="text-zinc-500">Маржа: </span>
                  <span className="font-semibold tabular-nums text-emerald-800">
                    {marginPct !== null ? `${marginPct}%` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Прибыль: </span>
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {order.profit.toString()}
                  </span>
                </div>
              </div>
            </dd>
          </div>
        </dl>
      </Card>

      <AdminOrderForm
        order={order}
        executors={executors}
        executorScores={executorScores}
      />

      <Card className="p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

      <Card className="p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Файлы</h2>
            <p className="mt-0.5 text-xs text-zinc-500">ТЗ, брифы, референсы и результаты работы</p>
          </div>
          {files.length > 0 && (
            <a
              href={`/api/orders/${id}/files/archive`}
              className="text-sm font-medium text-zinc-800 underline-offset-2 hover:underline"
            >
              Скачать архив (ZIP)
            </a>
          )}
        </div>

        <AdminFileUpload orderId={id} />

        {files.length > 0 && (
          <ul className="mt-5 space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    f.uploadedBy === "admin"
                      ? "bg-zinc-200 text-zinc-800"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {f.uploadedBy === "admin" ? "Админ" : "Исполнитель"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/files/${f.id}`}
                      className="min-w-0 truncate font-medium text-zinc-900 underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {displayFileEntryLabel(f)}
                    </a>
                    {f.kind === "link" && (
                      <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600">
                        Ссылка
                      </span>
                    )}
                  </div>
                  {f.comment && (
                    <p className="mt-0.5 text-xs text-zinc-500">{f.comment}</p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {new Date(f.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {files.length === 0 && (
          <p className="mt-4 text-sm text-zinc-400">Файлов пока нет.</p>
        )}
      </Card>

      <AdminOrderDelete orderId={id} />

      <Card className="p-4 md:p-6">
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
