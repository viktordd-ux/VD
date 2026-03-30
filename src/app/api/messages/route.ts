import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import {
  createInAppNotification,
  createInAppNotificationForAdmins,
} from "@/lib/in-app-notifications";
import { serializeMessage } from "@/lib/message-serialize";
import {
  pushNotifyAdminsNewChatMessage,
  pushNotifyExecutorChatMessage,
} from "@/lib/push-notify";
import { notifyExecutorChatMessage } from "@/lib/telegram-notify";

const MAX_LEN = 8000;

async function loadOrderForChat(orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    select: { id: true, executorId: true, title: true },
  });
}

function canAccessOrder(
  role: "admin" | "executor",
  userId: string,
  order: { executorId: string | null },
): boolean {
  if (role === "admin") return true;
  return order.executorId === userId;
}

/** GET /api/messages?order_id=… — история чата по заказу */
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  const order = await loadOrderForChat(orderId);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessOrder(user.role, user.id, order)) {
    return forbidden();
  }

  const rows = await prisma.message.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages: rows.map(serializeMessage) });
}

/** POST /api/messages — { order_id, text }; время created_at только из БД (@default(now())). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = (await req.json()) as Record<string, unknown>;
  const orderId =
    typeof body.order_id === "string" ? body.order_id.trim() : "";
  const textRaw = typeof body.text === "string" ? body.text.trim() : "";
  const replyToIdRaw =
    typeof body.reply_to_id === "string" ? body.reply_to_id.trim() : "";
  const replyToId = replyToIdRaw || null;
  // createdAt / created_at с клиента не используются
  if (!orderId) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }
  if (!textRaw) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (textRaw.length > MAX_LEN) {
    return NextResponse.json(
      { error: `text too long (max ${MAX_LEN})` },
      { status: 400 },
    );
  }

  const order = await loadOrderForChat(orderId);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessOrder(user.role, user.id, order)) {
    return forbidden();
  }

  const role = user.role === "admin" ? "admin" : "executor";

  if (replyToId) {
    const parent = await prisma.message.findFirst({
      where: { id: replyToId, orderId },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "reply_to_id not found in this order" },
        { status: 400 },
      );
    }
  }

  let created;
  try {
    created = await prisma.message.create({
      data: {
        orderId,
        senderId: user.id,
        role,
        text: textRaw,
        ...(replyToId ? { replyToId } : {}),
      },
    });
  } catch (e) {
    const hint =
      e instanceof Prisma.PrismaClientKnownRequestError
        ? e.code === "P2022" || (e.meta as { column?: string } | undefined)?.column
          ? " Выполните SQL из scripts/ensure-messages-reply-column.sql в Supabase (колонка reply_to_id)."
          : ""
        : "";
    const raw =
      typeof e === "object" && e !== null && "message" in e
        ? String((e as { message?: unknown }).message)
        : String(e);
    const isMissingColumn =
      /reply_to_id|column.*does not exist|Unknown column/i.test(raw);
    return NextResponse.json(
      {
        error: isMissingColumn
          ? "База не обновлена: добавьте колонку reply_to_id для messages (скрипт scripts/ensure-messages-reply-column.sql)."
          : `Не удалось сохранить сообщение.${hint}`,
      },
      { status: 500 },
    );
  }

  const preview = textRaw.length > 180 ? `${textRaw.slice(0, 177)}…` : textRaw;

  /** In-app сразу в БД → Realtime INSERT до ответа (без after). */
  try {
    if (user.role === "admin" && order.executorId) {
      await createInAppNotification({
        userId: order.executorId,
        kind: "chat",
        title: `Сообщение в «${order.title}»`,
        body: preview,
        linkHref: `/executor/orders/${orderId}`,
      });
    }
    if (user.role === "executor") {
      await createInAppNotificationForAdmins({
        kind: "chat",
        title: `Новое сообщение: ${order.title}`,
        body: preview,
        linkHref: `/admin/orders/${orderId}`,
      });
    }
  } catch {
    // не блокируем ответ; push/Telegram ниже
  }

  after(async () => {
    try {
      if (user.role === "admin" && order.executorId) {
        notifyExecutorChatMessage(order.executorId);
        pushNotifyExecutorChatMessage(order.executorId, order.title, orderId);
      }
      if (user.role === "executor") {
        pushNotifyAdminsNewChatMessage(order.title, orderId);
      }
    } catch {
      /* ignore */
    }
  });

  return NextResponse.json({ message: serializeMessage(created) });
}
