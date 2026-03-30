import { CHAT_DISPLAY_TIMEZONE } from "@/lib/chat-display-time";
import type { MessageDto } from "@/lib/message-serialize";

function ymdInTz(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
}

function todayYmd(): string {
  return ymdInTz(new Date().toISOString());
}

function yesterdayYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ymdInTz(d.toISOString());
}

/** Подпись для разделителя дат в чате (Сегодня / Вчера / дата). */
export function formatChatDayDividerLabel(dayYmd: string): string {
  if (dayYmd === todayYmd()) return "Сегодня";
  if (dayYmd === yesterdayYmd()) return "Вчера";
  const [y, m, day] = dayYmd.split("-").map(Number);
  if (!y || !m || !day) return dayYmd;
  const dt = new Date(y, m - 1, day);
  return dt.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: y !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function dayKeyFromMessageIso(iso: string): string {
  return ymdInTz(iso);
}

export type MessageGroup = {
  senderId: string;
  mine: boolean;
  role: MessageDto["role"];
  items: MessageDto[];
};

export type ChatTimelineItem =
  | { kind: "day"; dayKey: string; label: string }
  | { kind: "group"; group: MessageGroup };

/** Вставляет разделители дней перед первой группой нового календарного дня. */
export function buildChatTimeline(groups: MessageGroup[]): ChatTimelineItem[] {
  const out: ChatTimelineItem[] = [];
  let lastDay: string | null = null;
  for (const g of groups) {
    const first = g.items[0];
    if (!first) continue;
    const dk = dayKeyFromMessageIso(first.createdAt);
    if (dk && dk !== lastDay) {
      lastDay = dk;
      out.push({
        kind: "day",
        dayKey: dk,
        label: formatChatDayDividerLabel(dk),
      });
    }
    out.push({ kind: "group", group: g });
  }
  return out;
}
