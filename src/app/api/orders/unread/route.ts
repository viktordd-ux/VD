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
  isFallback: false,
} as const;

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[orders/unread]", ...args);
  }
};

/**
 * Глобальный индикатор (сайдбар): непрочитанные чаты по заказам + непрочитанные уведомления.
 * Всегда 200 и тело { unreadChatOrderCount, notificationUnreadCount, isFallback }.
 */
export async function GET() {
  devLog("GET start");
  try {
    const session = await auth();
    devLog("userId:", session?.user?.id);

    if (!session?.user?.id) {
      return NextResponse.json({ ...ZEROS });
    }

    const uid = session.user.id;
    let isFallback = false;

    const unreadChatOrderCount = await getUnreadChatOrderCount(uid).catch((err) => {
      isFallback = true;
      if (process.env.NODE_ENV === "development") {
        console.error("[orders/unread] unreadChatOrderCount failed", err);
      }
      return 0;
    });

    const notificationUnreadCount = await prisma.notification
      .count({ where: { userId: uid, readAt: null } })
      .catch((err) => {
        isFallback = true;
        if (process.env.NODE_ENV === "development") {
          console.error("[orders/unread] notificationUnreadCount failed", err);
        }
        return 0;
      });

    return NextResponse.json({
      unreadChatOrderCount,
      notificationUnreadCount,
      isFallback,
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[orders/unread] GET failed", err);
    }
    return NextResponse.json({
      unreadChatOrderCount: 0,
      notificationUnreadCount: 0,
      isFallback: true,
    });
  }
}

/**
 * Батч по заказам: флаги для списков + те же счётчики, что и в GET.
 * Body: { orderIds: string[] }
 */
export async function POST(req: Request) {
  devLog("POST start");
  try {
    const session = await auth();
    devLog("userId:", session?.user?.id);

    if (!session?.user?.id) {
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
    let batchFailed = false;
    try {
      const accessible = await filterAccessibleOrderIds(uid, requested);
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
      batchFailed = true;
      if (process.env.NODE_ENV === "development") {
        console.error("[orders/unread] POST batch flags failed", err);
      }
    }

    let isFallback = batchFailed;

    const unreadChatOrderCount = await getUnreadChatOrderCount(uid).catch((e) => {
      isFallback = true;
      if (process.env.NODE_ENV === "development") {
        console.error("[orders/unread] unreadChatOrderCount failed", e);
      }
      return 0;
    });

    const notificationUnreadCount = await prisma.notification
      .count({ where: { userId: uid, readAt: null } })
      .catch((e) => {
        isFallback = true;
        if (process.env.NODE_ENV === "development") {
          console.error("[orders/unread] notificationUnreadCount failed", e);
        }
        return 0;
      });

    return NextResponse.json({
      orders,
      unreadChatOrderCount,
      notificationUnreadCount,
      isFallback,
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[orders/unread] POST failed", err);
    }
    return NextResponse.json({
      orders: [],
      unreadChatOrderCount: 0,
      notificationUnreadCount: 0,
      isFallback: true,
    });
  }
}
