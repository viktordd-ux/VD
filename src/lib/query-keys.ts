export const queryKeys = {
  /** Список пользователей студии (инвалидация после создания и т.п.). */
  adminUsers: () => ["admin", "users"] as const,
  adminTemplates: () => ["admin", "templates"] as const,
  /** Один запрос: полный каталог заказов; фильтры из URL применяются в useMemo. */
  adminOrdersCatalog: () => ["admin", "orders", "catalog"] as const,
  /** @deprecated используйте adminOrdersCatalog + derive */
  adminOrders: (searchParams: string) => ["admin", "orders", searchParams] as const,
  adminOrder: (id: string) => ["admin", "order", id] as const,
  executorHome: (userId: string) => ["executor", "home", userId] as const,
  orderMessages: (orderId: string) => ["order", "messages", orderId] as const,
  globalSearch: (q: string) => ["admin", "search", q] as const,
  notifications: () => ["notifications"] as const,
  navBadges: () => ["nav-badges"] as const,
};
