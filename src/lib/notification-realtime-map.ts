export type NotificationListRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Строка из Supabase postgres_changes / snake_case. */
export function parseNotificationRealtimeRow(
  input: Record<string, unknown> | null | undefined,
): NotificationListRow | null {
  if (!input || typeof input !== "object") return null;
  const id = input.id != null ? String(input.id) : "";
  if (!id) return null;
  const createdRaw = input.created_at ?? input.createdAt;
  let createdAt = "";
  if (typeof createdRaw === "string") createdAt = createdRaw;
  else if (createdRaw instanceof Date) createdAt = createdRaw.toISOString();
  else createdAt = new Date().toISOString();

  return {
    id,
    kind: String(input.kind ?? ""),
    title: String(input.title ?? ""),
    body: String(input.body ?? ""),
    linkHref:
      input.link_href != null && input.link_href !== ""
        ? String(input.link_href)
        : null,
    readAt:
      input.read_at != null && input.read_at !== ""
        ? String(input.read_at)
        : null,
    createdAt,
  };
}
