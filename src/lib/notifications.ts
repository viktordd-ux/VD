import { getNotificationSettings } from "@/lib/notification-settings";

export type NotifyChannel = "toast" | "email" | "push";

export type NotifyEvent =
  | "order_submit_review"
  | "checkpoint_done"
  | "checkpoints_complete_all"
  | "silence_warning"
  | "silence_high"
  | "low_margin";

export type NotifyPayload = {
  key: string;
  title: string;
  body?: string;
  audience: "admin" | "executor";
  event?: NotifyEvent;
  meta?: Record<string, unknown>;
};

function logDev(payload: NotifyPayload) {
  if (process.env.NODE_ENV === "development") {
    console.info("[notify]", payload.event ?? "generic", payload.title, payload.body);
  }
}

/** Серверная отправка: email (если включено) + лог. Toast на клиенте — через API-ответы и polling. */
export async function dispatchNotification(payload: NotifyPayload): Promise<void> {
  logDev(payload);
  const s = getNotificationSettings();
  if (!s.emailEnabled) return;
  const to =
    payload.audience === "admin"
      ? s.adminEmail
      : undefined;
  if (!to) return;
  // Подключите nodemailer / Resend:
  // await sendMail({ to, subject: payload.title, text: payload.body ?? "" });
}
