import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { getUnreadFlagsForOrders } from "@/lib/order-unread-state";

export const dynamic = "force-dynamic";

function canAccessOrder(
  role: "admin" | "executor",
  userId: string,
  order: { executorId: string | null },
): boolean {
  if (role === "admin") return true;
  return order.executorId === userId;
}

/** GET — флаги непрочитанного чата и проекта (вычислены на сервере). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const orderId = (await params).id;
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    select: { id: true, executorId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessOrder(user.role, user.id, order)) return forbidden();

  const map = await getUnreadFlagsForOrders(user.id, [orderId]);
  const flags = map.get(orderId);
  if (!flags) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    hasUnreadChat: flags.hasUnreadChat,
    hasUnreadProject: flags.hasUnreadProject,
    hasUnreadAny: flags.hasUnreadAny,
  });
}

/** PATCH — отметить чат и/или «страницу заказа» просмотренными; ответ — актуальные флаги. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const orderId = (await params).id;
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    select: { id: true, executorId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessOrder(user.role, user.id, order)) return forbidden();

  let body: { markChat?: boolean; markProject?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const markChat = body.markChat === true;
  const markProject = body.markProject === true;
  if (!markChat && !markProject) {
    return NextResponse.json({ error: "markChat or markProject required" }, { status: 400 });
  }

  const now = new Date();

  await prisma.orderUserReadState.upsert({
    where: { userId_orderId: { userId: user.id, orderId } },
    create: {
      userId: user.id,
      orderId,
      chatReadAt: markChat ? now : null,
      projectReadAt: markProject ? now : null,
    },
    update: {
      ...(markChat ? { chatReadAt: now } : {}),
      ...(markProject ? { projectReadAt: now } : {}),
    },
  });

  const map = await getUnreadFlagsForOrders(user.id, [orderId]);
  const flags = map.get(orderId);
  if (!flags) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    hasUnreadChat: flags.hasUnreadChat,
    hasUnreadProject: flags.hasUnreadProject,
    hasUnreadAny: flags.hasUnreadAny,
  });
}
