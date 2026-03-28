import type { WebPushPayload } from "@/lib/push-send";
import { sendPushToUser } from "@/lib/push-send";
import { pushLogServer } from "@/lib/push-debug";

/**
 * Отправка Web Push одному пользователю (все его подписки в БД).
 * Учитывает `pushEnabled` и наличие VAPID; невалидные endpoint (410/404) удаляются в push-send.
 */
export async function sendPush(
  userId: string,
  payload: WebPushPayload,
): Promise<void> {
  pushLogServer("sendPush()", "userId=", userId, "title=", payload.title);
  await sendPushToUser(userId, payload);
}
