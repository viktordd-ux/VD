export const queryKeys = {
  adminOrders: (searchParams: string) => ["admin", "orders", searchParams] as const,
  adminOrder: (id: string) => ["admin", "order", id] as const,
  executorHome: (userId: string) => ["executor", "home", userId] as const,
  orderMessages: (orderId: string) => ["order", "messages", orderId] as const,
  globalSearch: (q: string) => ["admin", "search", q] as const,
  notifications: () => ["notifications"] as const,
  navBadges: () => ["nav-badges"] as const,
};
