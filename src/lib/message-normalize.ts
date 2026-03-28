import type { MessageDto } from "@/lib/message-serialize";

/** Число мс для сортировки; NaN/невалид → 0 (дальше порядок по id). */
export function normalizeCreatedAt(value: unknown): number {
  const date = new Date(value as string | number | Date);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Единый формат на клиенте: ISO-строка из значения БД/API/Realtime. */
export function toIsoCreatedAt(value: unknown): string {
  const t = normalizeCreatedAt(value);
  return new Date(t).toISOString();
}

/**
 * Приводит произвольный объект к MessageDto с createdAt в ISO.
 * Не использует Date.now() и не подставляет «локальное» время.
 */
export function normalizeMessageDto(input: unknown): MessageDto | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : "";
  const orderId =
    o.orderId != null
      ? String(o.orderId)
      : o.order_id != null
        ? String(o.order_id)
        : "";
  const senderId =
    o.senderId != null
      ? String(o.senderId)
      : o.sender_id != null
        ? String(o.sender_id)
        : "";
  const text = o.text != null ? String(o.text) : "";
  const role = o.role;
  if (!id || !orderId || !senderId || !text) return null;
  if (role !== "admin" && role !== "executor") return null;
  const rawTime =
    o.created_at !== undefined && o.created_at !== null
      ? o.created_at
      : o.createdAt;
  if (rawTime === undefined || rawTime === null) return null;
  const createdAt = toIsoCreatedAt(rawTime);
  return {
    id,
    orderId,
    senderId,
    role,
    text,
    createdAt,
  };
}
