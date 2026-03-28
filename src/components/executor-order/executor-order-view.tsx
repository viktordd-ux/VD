"use client";

import Link from "next/link";
import { ExecutorCheckpoints } from "@/components/executor-checkpoints";
import { ExecutorOrderPanel } from "@/app/executor/orders/[id]/ui";
import { ExecutorOrderToolbar } from "@/components/executor-order-toolbar";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Card } from "@/components/ui/card";
import { displayFileEntryLabel } from "@/lib/uploads";
import { OrderChat } from "@/components/order-chat/order-chat";
import { useExecutorOrder } from "./executor-order-context";

export function ExecutorOrderView({
  orderId,
  supabaseUrl,
  supabaseAnonKey,
}: {
  orderId: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const { order, files } = useExecutorOrder();
  const executorFiles = files.filter((f) => f.uploadedBy === "executor");
  const studioFiles = files.filter((f) => f.uploadedBy === "admin");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href="/executor" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← К задачам
      </Link>
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {order.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{order.platform}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Техническое задание
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{order.description}</p>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Дедлайн</h2>
        <p className="mt-3 text-sm">
          {order.deadline ? order.deadline.toISOString().slice(0, 16).replace("T", " ") : "—"}
        </p>
      </Card>

      <OrderChat
        orderId={orderId}
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
      />

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Этапы</h2>
        <div className="mt-3">
          <ExecutorCheckpoints />
        </div>
        <div className="mt-6 border-t border-zinc-100 pt-4">
          <ExecutorOrderToolbar orderId={orderId} />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Мои файлы
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Загруженные вами с комментариями.
        </p>
        <ul className="mt-3 space-y-3 text-sm">
          {executorFiles.map((f) => (
            <li key={f.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/files/${f.id}`}
                  className="min-w-0 font-medium text-zinc-900 underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {displayFileEntryLabel(f)}
                </a>
                {f.kind === "link" && (
                  <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-700">
                    Ссылка
                  </span>
                )}
              </div>
              {f.comment ? (
                <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-600">
                  {f.comment}
                </p>
              ) : (
                <p className="mt-1 text-xs text-zinc-400">Без комментария</p>
              )}
            </li>
          ))}
          {executorFiles.length === 0 && (
            <li className="text-zinc-500">Вы ещё не загружали файлы по этому заказу.</li>
          )}
        </ul>
      </Card>

      {studioFiles.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Материалы студии
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {studioFiles.map((f) => (
              <li key={f.id}>
                <a
                  href={`/api/files/${f.id}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {displayFileEntryLabel(f)}
                </a>
                {f.comment ? (
                  <span className="text-zinc-500"> — {f.comment}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ExecutorOrderPanel orderId={order.id} />
    </div>
  );
}
