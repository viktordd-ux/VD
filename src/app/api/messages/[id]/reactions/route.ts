import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import {
  loadOrderForChatAccess,
  userCanAccessOrderChat,
} from "@/lib/order-chat-access";
import { isAllowedChatReactionEmoji } from "@/lib/chat-reaction-emojis";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: messageId } = await params;

  let emoji = "";
  try {
    const body = (await req.json()) as { emoji?: string };
    emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isAllowedChatReactionEmoji(emoji)) {
    return NextResponse.json({ error: "invalid emoji" }, { status: 400 });
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { orderId: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await loadOrderForChatAccess(msg.orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await userCanAccessOrderChat(user.id, order))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: user.id,
          emoji,
        },
      },
      create: {
        messageId,
        orderId: msg.orderId,
        userId: user.id,
        emoji,
      },
      update: {},
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[reactions POST]", e);
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: messageId } = await params;

  const url = new URL(req.url);
  let emoji = url.searchParams.get("emoji")?.trim() ?? "";
  if (!emoji) {
    const body = (await req.json().catch(() => ({}))) as { emoji?: string };
    emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  }
  if (!emoji) {
    return NextResponse.json({ error: "emoji required" }, { status: 400 });
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { orderId: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await loadOrderForChatAccess(msg.orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await userCanAccessOrderChat(user.id, order))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.messageReaction.deleteMany({
    where: {
      messageId,
      orderId: msg.orderId,
      userId: user.id,
      emoji,
    },
  });

  return NextResponse.json({ ok: true });
}
