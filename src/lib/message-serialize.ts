import type { Message, MessageRole } from "@prisma/client";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { parseChatAttachmentsJson } from "@/lib/chat-attachments";

/** createdAt — всегда ISO 8601 из сервера (БД). */
export type MessageReactionAgg = {
  emoji: string;
  userIds: string[];
};

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
  reactions?: MessageReactionAgg[];
};

function aggregateReactions(
  rows: { userId: string; emoji: string }[],
): MessageReactionAgg[] {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const prev = map.get(r.emoji) ?? [];
    prev.push(r.userId);
    map.set(r.emoji, prev);
  }
  return [...map.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));
}

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
    reactions?: { userId: string; emoji: string }[];
  },
): MessageDto {
  const base = serializeMessage(m);
  const reactions =
    m.reactions && m.reactions.length > 0
      ? aggregateReactions(m.reactions)
      : undefined;
  return {
    ...base,
    senderName: m.sender.name,
    ...(reactions?.length ? { reactions } : {}),
  };
}
