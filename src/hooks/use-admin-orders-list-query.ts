"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";
import type { AdminOrdersListQueryPayload } from "@/lib/react-query-realtime";

export function useAdminOrdersListQuery(searchParamsString: string) {
  return useQuery({
    queryKey: queryKeys.adminOrders(searchParamsString),
    queryFn: async (): Promise<AdminOrdersListQueryPayload> => {
      const res = await fetch(
        `/api/admin/orders-list?${searchParamsString}`,
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Ошибка ${res.status}`);
      }
      return res.json();
    },
    staleTime: STALE_MS.list,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}
