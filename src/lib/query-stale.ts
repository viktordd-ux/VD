/** Единые окна свежести для React Query: меньше лишних refetch без потери актуальности. */
export const STALE_MS = {
  list: 120_000,
  detail: 120_000,
  messages: 120_000,
  search: 60_000,
  notifications: 60_000,
} as const;
