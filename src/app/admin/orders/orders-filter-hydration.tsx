"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const STORAGE_KEY = "vd_orders_filters_v1";

/** Восстанавливает query из localStorage при заходе на /admin/orders без параметров. */
export function OrdersFilterHydration() {
  const router = useRouter();
  const pathname = usePathname();
  const ran = useRef(false);

  useEffect(() => {
    if (pathname !== "/admin/orders") return;
    if (ran.current) return;
    const q = window.location.search;
    if (q.length > 1) {
      ran.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        ran.current = true;
        router.replace(`/admin/orders?${raw}`);
      }
    } catch {
      /* ignore */
    }
  }, [pathname, router]);

  return null;
}

export function saveOrdersFiltersQuery(queryWithoutQuestion: string) {
  try {
    localStorage.setItem(STORAGE_KEY, queryWithoutQuestion);
  } catch {
    /* ignore */
  }
}
