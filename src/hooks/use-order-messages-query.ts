"use client";

import { useQuery } from "@tanstack/react-query";
import type { MessageDto } from "@/lib/message-serialize";
import { normalizeMessageDto } from "@/lib/message-normalize";
import { sortMessagesStable } from "@/lib/chat-message-merge";
import { queryKeys } from "@/lib/query-keys";

export function useOrderMessagesQuery(
  orderId: string | undefined,
  sessionReady: boolean,
) {
  return useQuery({
    queryKey: orderId ? queryKeys.orderMessages(orderId) : ["order", "messages", "noop"],
    queryFn: async (): Promise<MessageDto[]> => {
      if (!orderId) return [];
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
      const data = (await res.json()) as { messages?: unknown[] };
      const raw = Array.isArray(data.messages) ? data.messages : [];
      const list = raw
        .map((x) => normalizeMessageDto(x))
        .filter((m): m is MessageDto => m != null);
      return sortMessagesStable(list);
    },
    enabled: !!orderId && sessionReady,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
