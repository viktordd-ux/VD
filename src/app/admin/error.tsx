"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin error boundary]", error);
    }
  }, [error]);

  return (
    <div className="space-y-6 py-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">Не удалось открыть раздел</h1>
      <Card className="border-red-500/25 bg-red-500/[0.06] p-6 dark:bg-red-950/25">
        <p className="text-sm text-[var(--text)]">
          Произошла ошибка при загрузке страницы. Попробуйте ещё раз или откройте заказы напрямую.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-[var(--muted)]">Код: {error.digest}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--bg)] transition hover:opacity-90"
          >
            Попробовать снова
          </button>
          <Link
            href="/admin/orders"
            className="rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[color:var(--muted-bg)]"
          >
            К заказам
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[color:var(--muted-bg)]"
          >
            Войти снова
          </Link>
        </div>
      </Card>
    </div>
  );
}
