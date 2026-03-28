"use client";

function isConnectionPoolError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("p2024") ||
    m.includes("connection pool") ||
    m.includes("timed out fetching") ||
    m.includes("pool timeout")
  );
}

export default function AdminOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = error.message ?? "";
  const pool = isConnectionPoolError(msg);
  const dev = process.env.NODE_ENV === "development";

  const hint = dev
    ? msg
    : pool
      ? "База не успела выдать соединение из пула (часто на Vercel + Supabase pooler). Подождите и нажмите «Попробовать снова» или проверьте DATABASE_URL и лимиты пула."
      : "Не удалось выполнить запрос к базе. Частые причины: не применены миграции после деплоя; таймаут пула соединений (P2024) при нагрузке; сеть или недоступность Postgres.";

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-semibold text-zinc-900">Не удалось загрузить заказы</h1>
      <p className="mt-2 text-sm text-zinc-600">{hint}</p>
      {!pool ? (
        <p className="mt-3 text-xs text-zinc-500">
          Если только что деплоили: выполните локально или в CI с прямым URL к Postgres (не pooler):{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5">npx prisma migrate deploy</code>
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          Для пула в URL обычно добавляют <code className="rounded bg-zinc-100 px-1">pool_timeout</code> и
          используют Transaction pooler Supabase (порт 6543). Миграции через pooler не гоняют — только{" "}
          <code className="rounded bg-zinc-100 px-1">DIRECT_URL</code>.
        </p>
      )}
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-zinc-400">Digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Попробовать снова
      </button>
    </div>
  );
}
