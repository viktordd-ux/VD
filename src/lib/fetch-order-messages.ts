import { sortMessagesStable } from "@/lib/chat-message-merge";
import { normalizeMessageDto } from "@/lib/message-normalize";
import type { ChatParticipantDto } from "@/lib/order-chat-access";
import type { MessageDto } from "@/lib/message-serialize";

export type OrderMessagesQueryData = {
  messages: MessageDto[];
  participants: ChatParticipantDto[];
};

/** Общий fetch для useQuery и prefetch (чат заказа). */
export async function fetchOrderMessages(
  orderId: string,
): Promise<OrderMessagesQueryData> {
  const res = await fetch(
    `/api/messages?order_id=${encodeURIComponent(orderId)}`,
    { cache: "no-store" },
  );
  if (res.status === 403) {
    throw new Error("forbidden");
  }
  if (!res.ok) {
    throw new Error("load");
  }
  const data = (await res.json()) as {
    messages?: unknown[];
    participants?: ChatParticipantDto[];
  };
  const raw = Array.isArray(data.messages) ? data.messages : [];
  const list = raw
    .map((x) => normalizeMessageDto(x))
    .filter((m): m is MessageDto => m != null);
  const participants = Array.isArray(data.participants)
    ? data.participants
    : [];
  return {
    messages: sortMessagesStable(list),
    participants,
  };
}
