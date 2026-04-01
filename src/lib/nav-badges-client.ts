import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export type NavBadgesPayload = {
  unreadChatOrderCount: number;
  notificationUnreadCount: number;
  isFallback: boolean;
};

/** Заказы, для которых уже учли +1 к distinct unread chat в этой сессии (после последнего успешного снимка API). */
const chatOrdersBumpedThisSession = new Set<string>();

export function resetNavBadgesChatDedupe() {
  chatOrdersBumpedThisSession.clear();
}

/** Клиентский fetch счётчиков для React Query (nav, без router.refresh). */
export async function fetchNavBadges(): Promise<NavBadgesPayload> {
  const res = await fetch("/api/orders/unread", { cache: "no-store" });
  try {
    const data = (await res.json()) as {
      unreadChatOrderCount?: unknown;
      notificationUnreadCount?: unknown;
      isFallback?: unknown;
    };
    const isFallback = Boolean(data.isFallback);
    return {
      unreadChatOrderCount: Math.max(0, Number(data.unreadChatOrderCount ?? 0)),
      notificationUnreadCount: Math.max(
        0,
        Number(data.notificationUnreadCount ?? 0),
      ),
      isFallback,
    };
  } catch {
    return {
      unreadChatOrderCount: 0,
      notificationUnreadCount: 0,
      isFallback: true,
    };
  }
}

/**
 * Новое входящее сообщение в заказе: +1 к числу заказов с непрочитанным чатом (distinct),
 * не более одного раза на заказ за сессию после последнего успешного API-снимка.
 */
export function bumpNavChatOnIncomingMessage(
  queryClient: QueryClient,
  orderId: string,
  currentUserId: string | undefined,
  senderId: string,
) {
  if (!currentUserId || senderId === currentUserId) return;
  if (chatOrdersBumpedThisSession.has(orderId)) return;
  chatOrdersBumpedThisSession.add(orderId);
  queryClient.setQueryData<NavBadgesPayload>(queryKeys.navBadges(), (prev) => {
    if (!prev) {
      return {
        unreadChatOrderCount: 1,
        notificationUnreadCount: 0,
        isFallback: false,
      };
    }
    return {
      ...prev,
      unreadChatOrderCount: prev.unreadChatOrderCount + 1,
      isFallback: false,
    };
  });
}

/** Пользователь отметил чат по заказу прочитанным — уменьшаем счётчик заказов с непрочитанным чатом. */
export function decrementNavChatOnOrderRead(
  queryClient: QueryClient,
  orderId: string,
) {
  chatOrdersBumpedThisSession.delete(orderId);
  queryClient.setQueryData<NavBadgesPayload>(queryKeys.navBadges(), (prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      unreadChatOrderCount: Math.max(0, prev.unreadChatOrderCount - 1),
      isFallback: false,
    };
  });
}

export function formatNavBadgeCount(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}

export function decrementNavNotificationByOne(queryClient: QueryClient) {
  queryClient.setQueryData<NavBadgesPayload>(queryKeys.navBadges(), (prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      notificationUnreadCount: Math.max(0, prev.notificationUnreadCount - 1),
      isFallback: false,
    };
  });
}

export function setNavNotificationUnreadToZero(queryClient: QueryClient) {
  queryClient.setQueryData<NavBadgesPayload>(queryKeys.navBadges(), (prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      notificationUnreadCount: 0,
      isFallback: false,
    };
  });
}

/** Фоновый resync счётчиков (события — основной источник). */
const NAV_BADGES_STALE_MS = 120_000;
const NAV_BADGES_REFETCH_INTERVAL_MS = 90_000;

export function getNavBadgesQueryOptions(queryClient: QueryClient) {
  return {
    queryKey: queryKeys.navBadges(),
    queryFn: async (): Promise<NavBadgesPayload> => {
      const data = await fetchNavBadges();
      if (data.isFallback) {
        const prev = queryClient.getQueryData<NavBadgesPayload>(
          queryKeys.navBadges(),
        );
        if (prev) return prev;
        throw new Error("nav-badges-fallback");
      }
      resetNavBadgesChatDedupe();
      return data;
    },
    staleTime: NAV_BADGES_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: NAV_BADGES_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: (i: number) => Math.min(1000 * 2 ** i, 10_000),
  } as const;
}
