import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  filterAccessibleOrderIds,
  getUnreadChatOrderCount,
  getUnreadFlagsForOrders,
} from "@/lib/order-unread-state";
import type { OrderUnreadBatchRow } from "@/lib/order-unread-service";

export const dynamic = "force-dynamic";

const ZEROS = {
  unreadChatOrderCount: 0,
  notificationUnreadCount: 0,
} as const;

function isRole(
  r: unknown,
): r is "admin" | "executor" {
  return r === "admin" || r === "executor";
}

/**
 * Глобальный индикатор (сайдбар): непрочитанные чаты по заказам + непрочитанные уведомления.
 * Всегда 200 и тело { unreadChatOrderCount, notificationUnreadCount }.
 */
export async function GET() {
  console.log("unread route start");
  try {
    const session = await auth();
    console.log("userId:", session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json({ ...ZEROS });
    }

    const role = session.user.role;
    if (!isRole(role)) {
      return NextResponse.json({ ...ZEROS });
    }

    const uid = session.user.id;
    const [unreadChatOrderCount, notificationUnreadCount] = await Promise.all([
      getUnreadChatOrderCount(uid, role).catch((err) => {
        console.error("[orders/unread] unreadChatOrderCount failed", err);
        return 0;
      }),
      prisma.notification
        .count({ where: { userId: uid, readAt: null } })
        .catch((err) => {
          console.error("[orders/unread] notificationUnreadCount failed", err);
          return 0;
        }),
    ]);

    return NextResponse.json({
      unreadChatOrderCount,
      notificationUnreadCount,
    });
  } catch (err) {
    console.error("[orders/unread] GET failed", err);
    return NextResponse.json({ ...ZEROS });
  }
}

/**
 * Батч по заказам: флаги для списков + те же счётчики, что и в GET.
 * Body: { orderIds: string[] }
 */
export async function POST(req: Request) {
  console.log("unread route POST start");
  try {
    const session = await auth();
    console.log("userId:", session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json({ orders: [], ...ZEROS });
    }

    const role = session.user.role;
    if (!isRole(role)) {
      return NextResponse.json({ orders: [], ...ZEROS });
    }

    const uid = session.user.id;

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

    let orders: OrderUnreadBatchRow[] = [];
    try {
      const accessible = await filterAccessibleOrderIds(uid, role, requested);
      const map = await getUnreadFlagsForOrders(uid, accessible);
      orders = accessible.map((orderId) => {
        const f = map.get(orderId)!;
        return {
          orderId,
          hasUnreadChat: f.hasUnreadChat,
          hasUnreadProject: f.hasUnreadProject,
          hasUnreadAny: f.hasUnreadAny,
        };
      });
    } catch (err) {
      console.error("[orders/unread] POST batch flags failed", err);
    }

    const [unreadChatOrderCount, notificationUnreadCount] = await Promise.all([
      getUnreadChatOrderCount(uid, role).catch((e) => {
        console.error("[orders/unread] unreadChatOrderCount failed", e);
        return 0;
      }),
      prisma.notification
        .count({ where: { userId: uid, readAt: null } })
        .catch((e) => {
          console.error("[orders/unread] notificationUnreadCount failed", e);
          return 0;
        }),
    ]);

    return NextResponse.json({
      orders,
      unreadChatOrderCount,
      notificationUnreadCount,
    });
  } catch (err) {
    console.error("[orders/unread] POST failed", err);
    return NextResponse.json({ orders: [], ...ZEROS });
  }
}
