import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ExecutorCheckpoints } from "@/components/executor-checkpoints";
import { ExecutorOrderToolbar } from "@/components/executor-order-toolbar";
import { OrderHistoryTabs } from "@/components/order-history-tabs";
import { ExecutorOrderPanel } from "./ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ExecutorOrderPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "executor") redirect("/admin");

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, executorId: session.user.id },
  });
  if (!order) notFound();

  const files = await prisma.file.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "desc" },
  });

  const checkpoints = await prisma.checkpoint.findMany({
    where: { orderId: id },
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
  });

  const executorFiles = files.filter((f) => f.uploadedBy === "executor");
  const studioFiles = files.filter((f) => f.uploadedBy === "admin");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href="/executor" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← К задачам
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{order.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {order.platform} · {order.status}
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">ТЗ</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{order.description}</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">Дедлайн</h2>
        <p className="mt-3 text-sm">
          {order.deadline ? order.deadline.toISOString().slice(0, 16).replace("T", " ") : "—"}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">Чекпоинты</h2>
        <div className="mt-3">
          <ExecutorCheckpoints checkpoints={checkpoints} />
        </div>
        <div className="mt-6 border-t border-zinc-100 pt-4">
          <ExecutorOrderToolbar
            orderId={id}
            status={order.status}
            hasCheckpoints={checkpoints.length > 0}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">
          Мои файлы
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Загруженные вами с комментариями.
        </p>
        <ul className="mt-3 space-y-3 text-sm">
          {executorFiles.map((f) => (
            <li key={f.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
              <a
                href={`/api/files/${f.id}`}
                className="font-medium text-blue-600 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {f.filePath.split("/").pop()}
              </a>
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
      </section>

      {studioFiles.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-zinc-500">
            Материалы студии
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {studioFiles.map((f) => (
              <li key={f.id}>
                <a
                  href={`/api/files/${f.id}`}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.filePath.split("/").pop()}
                </a>
                {f.comment ? (
                  <span className="text-zinc-500"> — {f.comment}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">
          История изменений
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Аудит и этапы по этому заказу (доступ только вашему заказу).
        </p>
        <div className="mt-3">
          <OrderHistoryTabs orderId={id} />
        </div>
      </section>

      <ExecutorOrderPanel orderId={order.id} status={order.status} />
    </div>
  );
}
