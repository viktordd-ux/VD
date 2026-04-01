"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  mergeCatalogWithView,
  type AdminOrdersCatalogPayload,
} from "@/lib/admin-orders-list-derive";
import type { AdminOrdersListQueryPayload } from "@/lib/react-query-realtime";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";

export function useAdminOrdersListQuery(searchParamsString: string) {
  const catalogQuery = useQuery({
    queryKey: queryKeys.adminOrdersCatalog(),
    queryFn: async () => {
      const res = await fetch("/api/admin/orders-list");
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Ошибка ${res.status}`);
      }
      return res.json() as Promise<AdminOrdersCatalogPayload>;
    },
    staleTime: STALE_MS.list,
    refetchOnWindowFocus: false,
  });

  const data = useMemo((): AdminOrdersListQueryPayload | undefined => {
    if (!catalogQuery.data) return undefined;
    return mergeCatalogWithView(catalogQuery.data, searchParamsString);
  }, [catalogQuery.data, searchParamsString]);

  return {
    ...catalogQuery,
    data,
  };
}
