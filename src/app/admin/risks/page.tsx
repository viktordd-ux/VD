import Link from "next/link";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Card } from "@/components/ui/card";
import { getOrderRiskFlags } from "@/lib/order-risk";
import { RiskOrderActions } from "./risk-actions";

export const dynamic = "force-dynamic";

export default async function RisksPage() {
  const [candidates, banned, executors] = await Promise.all([
    prisma.order.findMany({
      where: { ...orderIsActive, status: { not: "DONE" } },
      include: {
        executor: true,
        checkpoints: true,
        files: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({ where: { role: "executor", status: "banned" } }),
    prisma.user.findMany({
      where: { role: "executor", status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, skills: true },
    }),
  ]);

  const flagged = candidates
    .map((o) => ({
      order: o,
      flags: getOrderRiskFlags(o, o.checkpoints, o.files),
    }))
    .filter(
      (x) =>
        x.flags.redDeadline ||
        x.flags.redRevisions ||
        x.flags.yellowCheckpoint ||
        x.flags.yellowSilent ||
        x.flags.redSilent,
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Риски</h1>
      <p className="text-sm text-zinc-600">
        Активные заказы с автоматическими метками: просрочки, правки, этапы, тишина
        (пороги из переменных окружения).
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Заказы
        </h2>
        {flagged.length === 0 && (
          <p className="text-sm text-zinc-500">
            Сейчас нет заказов, подпадающих под выбранные риски.
          </p>
        )}
        {flagged.map(({ order, flags }) => (
          <Card key={order.id} className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {order.title}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <OrderStatusBadge status={order.status} />
                  <span>· правок: {order.revisionCount}</span>
                </p>
              </div>
              <RiskOrderActions
                orderId={order.id}
                deadline={order.deadline?.toISOString() ?? null}
                executorEmail={order.executor?.email ?? null}
                executors={executors}
                currentExecutorId={order.executorId}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {flags.redRevisions && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">Правки</span>
              )}
              {flags.redDeadline && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">Дедлайн</span>
              )}
              {flags.yellowCheckpoint && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                  Этап
                </span>
              )}
              {flags.yellowSilent && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                  Тишина (предупр.)
                </span>
              )}
              {flags.redSilent && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
                  Тишина (высокий)
                </span>
              )}
            </div>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Заблокированные исполнители
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {banned.map((u) => (
            <li key={u.id}>{u.name}</li>
          ))}
          {banned.length === 0 && <li className="text-zinc-500">Нет заблокированных</li>}
        </ul>
      </section>
    </div>
  );
}
