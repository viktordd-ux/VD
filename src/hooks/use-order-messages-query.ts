"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchOrderMessages,
  type OrderMessagesQueryData,
} from "@/lib/fetch-order-messages";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";

export type { OrderMessagesQueryData };

export function useOrderMessagesQuery(
  orderId: string | undefined,
  sessionReady: boolean,
) {
  return useQuery({
    queryKey: orderId ? queryKeys.orderMessages(orderId) : ["order", "messages", "noop"],
    queryFn: async (): Promise<OrderMessagesQueryData> => {
      if (!orderId) return { messages: [], participants: [] };
      return fetchOrderMessages(orderId);
    },
    enabled: !!orderId && sessionReady,
    staleTime: STALE_MS.messages,
    refetchOnWindowFocus: false,
  });
}
