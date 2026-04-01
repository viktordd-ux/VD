import type { Message, MessageRole } from "@prisma/client";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { parseChatAttachmentsJson } from "@/lib/chat-attachments";

/** createdAt — всегда ISO 8601 из сервера (БД). */
export type MessageDto = {
  id: string;
  orderId: string;
  senderId: string;
  role: MessageRole;
  text: string;
  createdAt: string;
  replyToId: string | null;
  /** Имя отправителя (для группового чата). */
  senderName?: string;
  attachments?: ChatAttachment[];
  /** Только клиент: оптимистичная отправка / ошибка сети. */
  clientSendStatus?: "sending" | "failed";
};

export function serializeMessage(m: Message): MessageDto {
  const attachments = parseChatAttachmentsJson(m.attachments);
  return {
    id: m.id,
    orderId: m.orderId,
    senderId: m.senderId,
    role: m.role,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    replyToId: m.replyToId ?? null,
    ...(attachments.length ? { attachments } : {}),
  };
}

export function serializeMessageWithSender(
  m: Message & {
    sender: { name: string };
  },
): MessageDto {
  const base = serializeMessage(m);
  return {
    ...base,
    senderName: m.sender.name,
  };
}
