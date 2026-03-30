/**
 * Время в чате показываем в **Europe/Moscow** для всех пользователей,
 * чтобы время отправки совпадало с «московским» и не зависело от TZ устройства.
 *
 * Раньше можно было переопределить через NEXT_PUBLIC_CHAT_TIMEZONE; на практике
 * значение UTC из .env ломало отображение — для продукта фиксируем Москву.
 */
export const CHAT_DISPLAY_TIMEZONE = "Europe/Moscow" as const;

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
