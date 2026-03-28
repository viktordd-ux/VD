/**
 * Время в чате показываем в одной зоне для всех пользователей, иначе при разных
 * настройках часового пояса на устройствах «одно и то же» сообщение выглядит на ±N часов.
 *
 * Переопределение: NEXT_PUBLIC_CHAT_TIMEZONE (IANA), например Europe/Moscow.
 */
export const CHAT_DISPLAY_TIMEZONE =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_CHAT_TIMEZONE?.trim()
    ? process.env.NEXT_PUBLIC_CHAT_TIMEZONE.trim()
    : "Europe/Moscow";

export function formatChatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    timeZone: CHAT_DISPLAY_TIMEZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
