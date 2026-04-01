import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import {
  loadOrderForChatAccess,
  userCanAccessOrderChat,
} from "@/lib/order-chat-access";
import { serializeMessageWithSender } from "@/lib/message-serialize";
import {
  mergeAttachmentsByFileId,
  parseChatAttachmentsJson,
  toPrismaAttachmentsJson,
  type ChatAttachment,
} from "@/lib/chat-attachments";

type Params = { params: Promise<{ id: string }> };

/** POST /api/messages/{id}/attachments — догрузка вложений к уже созданному сообщению. */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: messageId } = await params;

  let incoming: ChatAttachment[] = [];
  try {
    const body = (await req.json()) as { attachments?: unknown };
    if (Array.isArray(body.attachments)) {
      incoming = parseChatAttachmentsJson(body.attachments);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (incoming.length === 0) {
    return NextResponse.json(
      { error: "attachments required" },
      { status: 400 },
    );
  }

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { orderId: true, attachments: true },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await loadOrderForChatAccess(msg.orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await userCanAccessOrderChat(user.id, order))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const a of incoming) {
    const f = await prisma.file.findFirst({
      where: { id: a.fileId, orderId: msg.orderId },
    });
    if (!f) {
      return NextResponse.json(
        { error: "attachment file not found in order" },
        { status: 400 },
      );
    }
  }

  const existing = parseChatAttachmentsJson(msg.attachments);
  const merged = mergeAttachmentsByFileId(existing, incoming);

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { attachments: toPrismaAttachmentsJson(merged) },
    include: {
      sender: { select: { name: true } },
      reactions: { select: { userId: true, emoji: true } },
    },
  });

  return NextResponse.json({ message: serializeMessageWithSender(updated) });
}
