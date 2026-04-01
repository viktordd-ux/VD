"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { AdminOrdersCatalogPayload } from "@/lib/admin-orders-list-derive";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";

/** Подгрузка полного каталога заказов (один запрос без query string). */
export function usePrefetchAdminOrdersList() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.adminOrdersCatalog(),
      queryFn: async (): Promise<AdminOrdersCatalogPayload> => {
        const res = await fetch("/api/admin/orders-list");
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `Ошибка ${res.status}`);
        }
        return res.json();
      },
      staleTime: STALE_MS.list,
    });
  }, [queryClient]);
}
