"use client";

export default function AdminOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const hint =
    process.env.NODE_ENV === "development"
      ? error.message
      : "Часто это из‑за того, что на сервере не применены миграции Prisma после деплоя.";

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-semibold text-zinc-900">Не удалось загрузить заказы</h1>
      <p className="mt-2 text-sm text-zinc-600">{hint}</p>
      <p className="mt-3 text-xs text-zinc-500">
        Выполните локально или в CI с прямым URL к Postgres (не pooler):{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5">npx prisma migrate deploy</code>
      </p>
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
