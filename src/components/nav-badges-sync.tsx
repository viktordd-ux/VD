"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getNavBadgesQueryOptions } from "@/lib/nav-badges-client";
import { queryKeys } from "@/lib/query-keys";

const RESYNC_MS = 3 * 60 * 1000;

/** Один источник правды для первичной гидрации + редкий resync (не refetchInterval у query). */
export function NavBadgesSync() {
  const queryClient = useQueryClient();
  const navOpts = useMemo(
    () => getNavBadgesQueryOptions(queryClient),
    [queryClient],
  );
  useQuery(navOpts);

  useEffect(() => {
    const t = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    }, RESYNC_MS);
    return () => window.clearInterval(t);
  }, [queryClient]);

  return null;
}
