/** Короткое сообщение для UI при ошибке Prisma / Postgres (Vercel, pooler, миграции). */
export function dbUnavailableUserMessage(error: unknown): string {
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    return error.message.slice(0, 280);
  }
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code ?? "")
      : "";
  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return "Не удаётся подключиться к базе данных. Проверьте DATABASE_URL на хостинге и доступность сервера БД.";
  }
  if (code === "P2022" || code === "P2010") {
    return "Схема базы не совпадает с приложением. Выполните миграции (prisma migrate deploy) к этой базе.";
  }
  return "База данных временно недоступна или не настроена. Проверьте переменные DATABASE_URL и DIRECT_URL в Vercel и примените миграции.";
}
