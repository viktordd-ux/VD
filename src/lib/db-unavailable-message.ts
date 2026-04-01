/** Код Prisma (P1001, …) из известных форм ошибок. */
function prismaErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const o = error as { code?: unknown; errorCode?: unknown };
  const c = o.code ?? o.errorCode;
  if (typeof c === "string" && /^P\d/.test(c)) return c;
  return "";
}

/** Короткое сообщение для UI при ошибке Prisma / Postgres (Vercel, pooler, миграции). */
export function dbUnavailableUserMessage(error: unknown): string {
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    return error.message.slice(0, 280);
  }
  const code = prismaErrorCode(error);
  const suffix = code ? ` Код Prisma: ${code}.` : "";

  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return `Не удаётся подключиться к базе данных. Проверьте DATABASE_URL на хостинге и доступность сервера БД.${suffix}`;
  }
  if (code === "P2022" || code === "P2010") {
    return `Схема базы не совпадает с приложением. Выполните миграции (prisma migrate deploy) к этой базе.${suffix}`;
  }
  return `База данных временно недоступна или не настроена. Проверьте переменные DATABASE_URL и DIRECT_URL в Vercel и примените миграции.${suffix}`;
}
