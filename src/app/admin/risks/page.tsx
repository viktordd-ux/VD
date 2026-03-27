import Link from "next/link";
import prisma from "@/lib/prisma";
import { getOrderRiskFlags } from "@/lib/order-risk";
import { RiskOrderActions } from "./risk-actions";

export const dynamic = "force-dynamic";

export default async function RisksPage() {
  const [candidates, banned, executors] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: "DONE" } },
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
      <h1 className="text-2xl font-semibold tracking-tight">Риски</h1>
      <p className="text-sm text-zinc-600">
        Активные заказы с авто-флагами: просрочки, правки, чекпоинты, тишина (пороги из
        SILENCE_WARNING_DAYS / SILENCE_HIGH_DAYS).
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">Заказы</h2>
        {flagged.length === 0 && (
          <p className="text-sm text-zinc-500">Сейчас нет записей по авто-флагам.</p>
        )}
        {flagged.map(({ order, flags }) => (
          <div
            key={order.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {order.title}
                </Link>
                <p className="text-xs text-zinc-500">
                  {order.status} · правок: {order.revisionCount}
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
                  Чекпоинт
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
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase text-zinc-500">
          Забаненные исполнители
        </h2>
        <ul className="mt-2 space-y-1 text-sm">
          {banned.map((u) => (
            <li key={u.id}>{u.name}</li>
          ))}
          {banned.length === 0 && <li className="text-zinc-500">Нет</li>}
        </ul>
      </section>
    </div>
  );
}
