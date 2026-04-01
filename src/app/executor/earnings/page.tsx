import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export default async function ExecutorEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "executor") redirect("/admin");
  if (session.user.onboarded !== true) redirect("/executor/onboarding");

  const executorId = session.user.id;
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const orderForExecutor = {
    executorId,
    ...orderIsActive,
  };

  const allWhere = {
    payoutReleasedAt: { not: null },
    order: orderForExecutor,
  };

  const [allAgg, weekAgg, monthAgg, recentCp] = await Promise.all([
    prisma.checkpoint.aggregate({
      where: allWhere,
      _sum: { paymentAmount: true },
      _count: true,
    }),
    prisma.checkpoint.aggregate({
      where: {
        payoutReleasedAt: { gte: weekAgo, lte: now },
        order: orderForExecutor,
      },
      _sum: { paymentAmount: true },
    }),
    prisma.checkpoint.aggregate({
      where: {
        payoutReleasedAt: { gte: monthAgo, lte: now },
        order: orderForExecutor,
      },
      _sum: { paymentAmount: true },
    }),
    prisma.checkpoint.findMany({
      where: allWhere,
      orderBy: { payoutReleasedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        paymentAmount: true,
        payoutReleasedAt: true,
        order: { select: { id: true, title: true } },
      },
    }),
  ]);

  const totalAll = Number(allAgg._sum.paymentAmount ?? 0);
  const totalWeek = Number(weekAgg._sum.paymentAmount ?? 0);
  const totalMonth = Number(monthAgg._sum.paymentAmount ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Заработок</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Суммы по этапам после принятия администратором. Периоды «7 дней» и «30 дней» считаются от даты
          принятия этапа.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">За всё время</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">{rub.format(totalAll)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Принятых этапов: {allAgg._count}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">За 7 дней</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">{rub.format(totalWeek)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">За 30 дней</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text)]">{rub.format(totalMonth)}</p>
        </Card>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Последние выплаты по этапам
        </h2>
        {recentCp.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Пока нет принятых этапов с выплатой. После того как администратор примет этап и укажет сумму,
            она появится здесь.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[var(--card)] shadow-sm shadow-black/[0.04] dark:shadow-black/40">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-[color:var(--border)] bg-[color:var(--muted-bg)]">
                <tr>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Заказ
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Этап
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Сумма
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Принят
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCp.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[color:var(--border)] transition-colors last:border-0 hover:bg-[color:var(--muted-bg)]"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/executor/orders/${r.order.id}`}
                        className="font-medium text-[var(--text)] hover:underline"
                      >
                        {r.order.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--text)]">{r.title}</td>
                    <td className="px-4 py-3.5 tabular-nums font-medium text-[var(--text)]">
                      {rub.format(Number(r.paymentAmount))}
                    </td>
                    <td className="px-4 py-3.5 text-xs tabular-nums text-[var(--muted)]">
                      {r.payoutReleasedAt
                        ? r.payoutReleasedAt.toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
