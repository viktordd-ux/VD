import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import {
  buildChatParticipants,
  chatOrderHrefForUser,
  getOrderChatParticipantUserIds,
  isStaffMembershipRole,
  loadOrderForChatAccess,
  userCanAccessOrderChat,
} from "@/lib/order-chat-access";
import { serializeMessageWithSender } from "@/lib/message-serialize";
import {
  parseChatAttachmentsJson,
  toPrismaAttachmentsJson,
  type ChatAttachment,
} from "@/lib/chat-attachments";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { sendPushToUser } from "@/lib/push-send";
import { sendTelegramMessage } from "@/lib/telegram";

const MAX_LEN = 8000;

/** GET /api/messages?order_id=… — история + участники (групповой чат заказа). */
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  const order = await loadOrderForChatAccess(orderId);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await userCanAccessOrderChat(user.id, order))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows, participants] = await Promise.all([
    prisma.message.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { name: true } },
        reactions: { select: { userId: true, emoji: true } },
      },
    }),
    buildChatParticipants(order),
  ]);

  return NextResponse.json({
    messages: rows.map(serializeMessageWithSender),
    participants,
  });
}

/** POST /api/messages — { order_id, text }; время created_at только из БД. */
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

  let attachments: ChatAttachment[] = [];
  if (Array.isArray(body.attachments)) {
    attachments = parseChatAttachmentsJson(body.attachments);
  }

  if (!orderId) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }
  if (!textRaw && attachments.length === 0) {
    return NextResponse.json(
      { error: "text or attachments required" },
      { status: 400 },
    );
  }
  if (textRaw.length > MAX_LEN) {
    return NextResponse.json(
      { error: `text too long (max ${MAX_LEN})` },
      { status: 400 },
    );
  }

  const order = await loadOrderForChatAccess(orderId);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await userCanAccessOrderChat(user.id, order))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const a of attachments) {
    const f = await prisma.file.findFirst({
      where: { id: a.fileId, orderId },
    });
    if (!f) {
      return NextResponse.json(
        { error: "attachment file not found in order" },
        { status: 400 },
      );
    }
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId: user.id, organizationId: order.organizationId },
    },
  });
  const messageRole =
    membership && isStaffMembershipRole(membership.role)
      ? ("admin" as const)
      : ("executor" as const);

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
        role: messageRole,
        text: textRaw,
        attachments: toPrismaAttachmentsJson(attachments),
        ...(replyToId ? { replyToId } : {}),
      },
      include: {
        sender: { select: { name: true } },
        reactions: { select: { userId: true, emoji: true } },
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

  const preview =
    textRaw.length > 0
      ? textRaw.length > 180
        ? `${textRaw.slice(0, 177)}…`
        : textRaw
      : attachments
          .map((a) => a.name)
          .filter(Boolean)
          .join(", ") || "Вложение";

  const participantIds = await getOrderChatParticipantUserIds(order);
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId: order.organizationId,
      userId: { in: participantIds },
    },
    select: { userId: true, role: true },
  });
  const roleByUser = new Map(memberships.map((m) => [m.userId, m.role]));

  try {
    for (const uid of participantIds) {
      if (uid === user.id) continue;
      const href = chatOrderHrefForUser(order.id, roleByUser.get(uid));
      await createInAppNotification({
        userId: uid,
        kind: "chat",
        title: `Сообщение в «${order.title}»`,
        body: preview,
        linkHref: href,
      });
    }
  } catch {
    /* ignore */
  }

  after(async () => {
    try {
      for (const uid of participantIds) {
        if (uid === user.id) continue;
        const href = chatOrderHrefForUser(order.id, roleByUser.get(uid));
        void sendPushToUser(uid, {
          title: "Новое сообщение",
          body: `Заказ «${order.title}»`,
          url: href,
        });
        void notifyChatTelegram(uid);
      }
    } catch {
      /* ignore */
    }
  });

  return NextResponse.json({ message: serializeMessageWithSender(created) });
}

async function notifyChatTelegram(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramId: true },
  });
  if (!u?.telegramId?.trim()) return;
  await sendTelegramMessage(u.telegramId.trim(), "Новое сообщение в заказе");
}
