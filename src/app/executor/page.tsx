import { auth } from "@/auth";
import { ExecutorChangePassword } from "@/components/executor-change-password";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { redirect } from "next/navigation";
import { ExecutorOrdersListClient } from "./executor-orders-list-client";
import { serializeExecutorHomeOrders } from "@/lib/order-list-client-serialize";

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
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Мои задачи</h1>

      <ExecutorOrdersListClient
        initialSerialized={serializeExecutorHomeOrders(orders)}
        userId={session.user.id}
      />

      <div id="password" className="scroll-mt-8">
        <ExecutorChangePassword />
      </div>
    </div>
  );
}
