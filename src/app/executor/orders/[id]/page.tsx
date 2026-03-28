import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import { getUnreadFlagsForOrders } from "@/lib/order-unread-state";
import { ExecutorOrderProvider } from "@/components/executor-order/executor-order-context";
import { ExecutorOrderRealtime } from "@/components/executor-order/executor-order-realtime";
import { ExecutorOrderView } from "@/components/executor-order/executor-order-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ExecutorOrderPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "executor") redirect("/admin");
  if (session.user.onboarded !== true) redirect("/executor/onboarding");

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, ...orderIsActive, executorId: session.user.id },
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

  const unreadMap = await getUnreadFlagsForOrders(session.user.id, [id]);
  const initialChatUnread = unreadMap.get(id)?.hasUnreadChat ?? false;

  return (
    <ExecutorOrderProvider
      initialOrder={order}
      initialCheckpoints={checkpoints}
      initialFiles={files}
    >
      <ExecutorOrderRealtime
        orderId={id}
        userId={session.user.id}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
        supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}
      />
      <ExecutorOrderView
        orderId={id}
        initialHasUnreadChat={initialChatUnread}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
        supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}
      />
    </ExecutorOrderProvider>
  );
}
