"use client";

import { useQuery } from "@tanstack/react-query";
import type { MessageDto } from "@/lib/message-serialize";
import type { ChatParticipantDto } from "@/lib/order-chat-access";
import { normalizeMessageDto } from "@/lib/message-normalize";
import { sortMessagesStable } from "@/lib/chat-message-merge";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";

export type OrderMessagesQueryData = {
  messages: MessageDto[];
  participants: ChatParticipantDto[];
};

export function useOrderMessagesQuery(
  orderId: string | undefined,
  sessionReady: boolean,
) {
  return useQuery({
    queryKey: orderId ? queryKeys.orderMessages(orderId) : ["order", "messages", "noop"],
    queryFn: async (): Promise<OrderMessagesQueryData> => {
      if (!orderId) return { messages: [], participants: [] };
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
    },
    enabled: !!orderId && sessionReady,
    staleTime: STALE_MS.messages,
    refetchOnWindowFocus: false,
  });
}
