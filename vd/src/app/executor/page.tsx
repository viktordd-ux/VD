import Link from "next/link";
import { auth } from "@/auth";
import { ExecutorChangePassword } from "@/components/executor-change-password";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExecutorHome() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "executor") redirect("/admin");

  const orders = await prisma.order.findMany({
    where: { executorId: session.user.id, status: { not: "DONE" } },
    orderBy: { deadline: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Мои задачи</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Дедлайн</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/executor/orders/${o.id}`} className="font-medium text-blue-600 hover:underline">
                    {o.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3">
                  {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="password" className="scroll-mt-8">
        <ExecutorChangePassword />
      </div>
    </div>
  );
}
