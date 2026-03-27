/** Настройки каналов уведомлений (env). По умолчанию toast включён, email — только при флаге. */
export function getNotificationSettings() {
  return {
    emailEnabled: process.env.NOTIFY_EMAIL_ENABLED === "true",
    adminToast: process.env.NOTIFY_ADMIN_TOAST !== "false",
    executorToast: process.env.NOTIFY_EXECUTOR_TOAST !== "false",
    pushEnabled: process.env.NOTIFY_PUSH_ENABLED === "true",
    adminEmail: process.env.NOTIFY_ADMIN_EMAIL ?? "",
  };
}
