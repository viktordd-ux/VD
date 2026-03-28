import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  filterAccessibleOrderIds,
  getHasAnyUnreadChat,
  getUnreadFlagsForOrders,
} from "@/lib/order-unread-state";
import type { OrderUnreadBatchRow } from "@/lib/order-unread-service";

export const dynamic = "force-dynamic";

/**
 * Глобальный индикатор (сайдбар): есть ли непрочитанные входящие сообщения в зоне роли.
 */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const hasAnyUnreadChats = await getHasAnyUnreadChat(user.id, user.role);
  return NextResponse.json({
    global: { hasAnyUnreadChats },
  });
}

/**
 * Батч по заказам: флаги для списков + тот же global, что и в GET.
 * Body: { orderIds: string[] }
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: { orderIds?: unknown };
  try {
    body = (await req.json()) as { orderIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.orderIds;
  const requested = Array.isArray(raw)
    ? raw.map((id) => (typeof id === "string" ? id : "")).filter(Boolean)
    : [];

  const accessible = await filterAccessibleOrderIds(user.id, user.role, requested);
  const map = await getUnreadFlagsForOrders(user.id, accessible);
  const orders: OrderUnreadBatchRow[] = accessible.map((orderId) => {
    const f = map.get(orderId)!;
    return {
      orderId,
      hasUnreadChat: f.hasUnreadChat,
      hasUnreadProject: f.hasUnreadProject,
      hasUnreadAny: f.hasUnreadAny,
    };
  });

  const hasAnyUnreadChats = await getHasAnyUnreadChat(user.id, user.role);

  return NextResponse.json({
    orders,
    global: { hasAnyUnreadChats },
  });
}
