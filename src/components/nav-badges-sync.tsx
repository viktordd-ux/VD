"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getNavBadgesQueryOptions } from "@/lib/nav-badges-client";
import { queryKeys } from "@/lib/query-keys";

/** Схлопываем всплески invalidate при realtime/чате в один refetch. */
const BADGE_INVALIDATE_DEBOUNCE_MS = 650;

/** Один источник правды: query + события + refetchInterval в getNavBadgesQueryOptions. */
export function NavBadgesSync() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<number | null>(null);
  const navOpts = useMemo(
    () => getNavBadgesQueryOptions(queryClient),
    [queryClient],
  );
  useQuery(navOpts);

  const scheduleBadgeRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    }, BADGE_INVALIDATE_DEBOUNCE_MS);
  }, [queryClient]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    window.addEventListener("vd:notifications-changed", scheduleBadgeRefetch);
    window.addEventListener("vd:order-unread-changed", scheduleBadgeRefetch);
    return () => {
      window.removeEventListener("vd:notifications-changed", scheduleBadgeRefetch);
      window.removeEventListener("vd:order-unread-changed", scheduleBadgeRefetch);
    };
  }, [scheduleBadgeRefetch]);

  return null;
}
