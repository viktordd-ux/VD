export type NotificationListRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Ответ GET /api/notifications (camelCase) или postgres_changes (snake_case). */
export function normalizeNotificationRow(input: unknown): NotificationListRow | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  if (!id) return null;

  const createdRaw = o.createdAt ?? o.created_at;
  let createdAt = "";
  if (typeof createdRaw === "string") createdAt = createdRaw;
  else if (createdRaw instanceof Date) createdAt = createdRaw.toISOString();
  else createdAt = new Date().toISOString();

  const readRaw = o.readAt ?? o.read_at;
  const readAt =
    readRaw != null && readRaw !== ""
      ? typeof readRaw === "string"
        ? readRaw
        : readRaw instanceof Date
          ? readRaw.toISOString()
          : null
      : null;

  const linkRaw = o.linkHref ?? o.link_href;
  const linkHref =
    linkRaw != null && linkRaw !== "" ? String(linkRaw) : null;

  return {
    id,
    kind: String(o.kind ?? ""),
    title: String(o.title ?? ""),
    body: String(o.body ?? ""),
    linkHref,
    readAt,
    createdAt,
  };
}

/** GET /api/notifications: без тихих потерь строк — с логом в dev при сбое нормализации. */
export function normalizeNotificationRowsFromApi(raw: unknown[]): NotificationListRow[] {
  const out: NotificationListRow[] = [];
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < raw.length; i++) {
    const n = normalizeNotificationRow(raw[i]);
    if (n) out.push(n);
    else if (process.env.NODE_ENV === "development") {
      console.warn("[notifications] normalizeNotificationRow skipped row", {
        index: i,
        row: raw[i],
      });
    }
  }
  return out;
}

/** Строка из Supabase postgres_changes / snake_case. */
export function parseNotificationRealtimeRow(
  input: Record<string, unknown> | null | undefined,
): NotificationListRow | null {
  return normalizeNotificationRow(input);
}
