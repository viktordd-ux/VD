import Link from "next/link";
import { auth } from "@/auth";
import { ExecutorChangePassword } from "@/components/executor-change-password";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import prisma from "@/lib/prisma";
import { OrderLiveRefresh } from "@/components/order-live-refresh";
import { orderIsActive } from "@/lib/active-scope";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExecutorHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "executor") redirect("/admin");
  if (session.user.onboarded !== true) redirect("/executor/onboarding");

  const orders = await prisma.order.findMany({
    where: {
      ...orderIsActive,
      executorId: session.user.id,
      status: { not: "DONE" },
    },
    orderBy: { deadline: "asc" },
  });

  return (
    <div className="space-y-8">
      <OrderLiveRefresh />
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Мои задачи</h1>

      {orders.length === 0 ? (
        <EmptyState
          title="Активных задач нет"
          description="Когда администратор назначит вам заказ, он появится в этом списке."
        />
      ) : (
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/90">
              <tr>
                <th className={thClass}>Название</th>
                <th className={thClass}>Статус</th>
                <th className={thClass}>Дедлайн</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={trClass}>
                  <td className={tdClass}>
                    <Link
                      href={`/executor/orders/${o.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {o.title}
                    </Link>
                  </td>
                  <td className={tdClass}>
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <div id="password" className="scroll-mt-8">
        <ExecutorChangePassword />
      </div>
    </div>
  );
}
