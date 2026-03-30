export type NavBadgesPayload = {
  unreadChatOrderCount: number;
  notificationUnreadCount: number;
};

/** Клиентский fetch счётчиков для React Query (nav, без router.refresh). */
export async function fetchNavBadges(): Promise<NavBadgesPayload> {
  const res = await fetch("/api/orders/unread", { cache: "no-store" });
  try {
    const data = (await res.json()) as {
      unreadChatOrderCount?: unknown;
      notificationUnreadCount?: unknown;
    };
    return {
      unreadChatOrderCount: Math.max(0, Number(data.unreadChatOrderCount ?? 0)),
      notificationUnreadCount: Math.max(
        0,
        Number(data.notificationUnreadCount ?? 0),
      ),
    };
  } catch {
    return { unreadChatOrderCount: 0, notificationUnreadCount: 0 };
  }
}
