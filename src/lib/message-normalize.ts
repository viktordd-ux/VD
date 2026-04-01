import type { MessageRole } from "@prisma/client";
import type { MessageDto, MessageReactionAgg } from "@/lib/message-serialize";
import { parseChatAttachmentsJson } from "@/lib/chat-attachments";

/**
 * Один момент времени в мс (UTC). Realtime/Postgres часто отдают строку без смещения
 * (`2026-03-28T12:32:00`). `new Date(...)` в браузере трактует это как **локальное** время
 * устройства → на разных TZ получаются разные UTC и «разъезд» на 3 ч. Наивные даты
 * из БД считаем **UTC** (как timestamptz/сессия на Supabase).
 */
export function parseMessageTimestampToMs(value: unknown): number {
  if (value == null) return NaN;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? NaN : t;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value !== "string") return NaN;
  const s = value.trim();
  if (!s) return NaN;

  if (/Z$/i.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? NaN : t;
  }
  if (/[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? NaN : t;
  }

  const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(\.\d+)?)$/.exec(s);
  if (naive) {
    const t = Date.parse(`${naive[1]}T${naive[2]}Z`);
    return Number.isNaN(t) ? NaN : t;
  }

  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

/** Число мс для сортировки; NaN/невалид → 0 (дальше порядок по id). */
export function normalizeCreatedAt(value: unknown): number {
  const ms = parseMessageTimestampToMs(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Единый формат на клиенте: ISO-строка (UTC) из значения БД/API/Realtime. */
export function toIsoCreatedAt(value: unknown): string {
  const ms = parseMessageTimestampToMs(value);
  if (Number.isNaN(ms)) return new Date(0).toISOString();
  return new Date(ms).toISOString();
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
  const attachments = parseChatAttachmentsJson(o.attachments);
  const roleRaw = o.role;
  const roleStr =
    typeof roleRaw === "string" ? roleRaw : String(roleRaw ?? "");
  const hasBody = text.trim().length > 0 || attachments.length > 0;
  if (!id || !orderId || !senderId || !hasBody) return null;
  if (roleStr !== "admin" && roleStr !== "executor") return null;

  const replyRaw = o.reply_to_id ?? o.replyToId;
  const replyToId =
    replyRaw != null && replyRaw !== ""
      ? String(replyRaw)
      : null;
  const rawTime =
    o.created_at !== undefined && o.created_at !== null
      ? o.created_at
      : o.createdAt;
  if (rawTime === undefined || rawTime === null) return null;
  const ms = parseMessageTimestampToMs(rawTime);
  if (Number.isNaN(ms)) return null;
  const createdAt = new Date(ms).toISOString();
  const senderNameRaw = o.senderName ?? o.sender_name;
  const senderName =
    typeof senderNameRaw === "string" && senderNameRaw.trim()
      ? senderNameRaw.trim()
      : undefined;

  let reactions: MessageReactionAgg[] | undefined;
  const rawRe = o.reactions;
  if (Array.isArray(rawRe)) {
    const agg = new Map<string, string[]>();
    for (const r of rawRe) {
      if (!r || typeof r !== "object") continue;
      const row = r as Record<string, unknown>;
      const em = row.emoji != null ? String(row.emoji) : "";
      const uid = row.userId ?? row.user_id;
      if (!em || uid == null) continue;
      const sid = String(uid);
      const prev = agg.get(em) ?? [];
      prev.push(sid);
      agg.set(em, prev);
    }
    if (agg.size > 0) {
      reactions = [...agg.entries()].map(([emoji, userIds]) => ({
        emoji,
        userIds,
      }));
    }
  }

  return {
    id,
    orderId,
    senderId,
    role: roleStr as MessageRole,
    text,
    createdAt,
    replyToId,
    ...(senderName ? { senderName } : {}),
    ...(attachments.length ? { attachments } : {}),
    ...(reactions?.length ? { reactions } : {}),
  };
}
