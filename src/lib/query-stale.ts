/** Единые окна свежести для React Query: меньше лишних refetch без потери актуальности. */
export const STALE_MS = {
  list: 180_000,
  detail: 180_000,
  messages: 180_000,
  search: 120_000,
  notifications: 180_000,
} as const;
