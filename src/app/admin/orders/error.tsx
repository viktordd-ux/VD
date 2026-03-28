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
  const poolLikely = isConnectionPoolError(msg);
  const dev = process.env.NODE_ENV === "development";

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-semibold text-zinc-900">Не удалось загрузить заказы</h1>

      {dev ? (
        <p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-zinc-700">
          {msg}
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">
          Запрос к базе не выполнился. Ниже — две частые причины; в production текст ошибки
          часто скрыт, поэтому показываем обе.
        </p>
      )}

      <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
        <div>
          <p className="font-semibold text-zinc-800">
            1. Пул соединений (P2024){poolLikely ? " — похоже на ваш случай" : ""}
          </p>
          <p className="mt-1">
            На Vercel + Supabase часто таймаут пула. Проверьте{" "}
            <code className="rounded bg-zinc-100 px-1">DATABASE_URL</code> (transaction pooler,
            порт 6543), параметр{" "}
            <code className="rounded bg-zinc-100 px-1">pool_timeout</code>, нажмите «Попробовать
            снова» через минуту.
          </p>
        </div>
        <div>
          <p className="font-semibold text-zinc-800">2. Миграции не накатились</p>
          <p className="mt-1">
            С прямым URL к Postgres (не pooler), из{" "}
            <code className="rounded bg-zinc-100 px-1">DIRECT_URL</code>:{" "}
            <code className="rounded bg-zinc-100 px-1">npx prisma migrate deploy</code>
          </p>
        </div>
      </div>

      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-zinc-400">Digest: {error.digest}</p>
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
