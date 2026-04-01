"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { AdminOrdersListQueryPayload } from "@/lib/react-query-realtime";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";

/** Подгрузка списка заказов (тот же queryFn, что и в useAdminOrdersListQuery). */
export function usePrefetchAdminOrdersList() {
  const queryClient = useQueryClient();
  return useCallback(
    (searchParamsString: string) => {
      void queryClient.prefetchQuery({
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
      });
    },
    [queryClient],
  );
}
