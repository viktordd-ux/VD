import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { serializeMessage } from "@/lib/message-serialize";
import { notifyExecutorChatMessage } from "@/lib/telegram-notify";

const MAX_LEN = 8000;

async function loadOrderForChat(orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, ...orderIsActive },
    select: { id: true, executorId: true },
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

/** POST /api/messages — { order_id, text } */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = (await req.json()) as { order_id?: string; text?: string };
  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const textRaw = typeof body.text === "string" ? body.text.trim() : "";
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

  const created = await prisma.message.create({
    data: {
      orderId,
      senderId: user.id,
      role,
      text: textRaw,
    },
  });

  if (user.role === "admin" && order.executorId) {
    notifyExecutorChatMessage(order.executorId);
  }

  return NextResponse.json({ message: serializeMessage(created) });
}
