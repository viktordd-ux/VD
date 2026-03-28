import type { Message, MessageRole } from "@prisma/client";

/** createdAt — всегда ISO 8601 из сервера (БД). */
export type MessageDto = {
  id: string;
  orderId: string;
  senderId: string;
  role: MessageRole;
  text: string;
  createdAt: string;
};

export function serializeMessage(m: Message): MessageDto {
  return {
    id: m.id,
    orderId: m.orderId,
    senderId: m.senderId,
    role: m.role,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
  };
}
