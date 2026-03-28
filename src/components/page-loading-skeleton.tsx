/** Общий вид «страница грузится» — для loading.tsx и оверлея при навигации. */
export function PageLoadingSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center justify-center gap-3 py-8"
          : "flex min-h-[min(60vh,28rem)] w-full flex-col items-center justify-center gap-4 px-4 py-16"
      }
    >
      <div
        className="h-11 w-11 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900"
        aria-hidden
      />
      <p className="text-sm font-medium text-zinc-500">Загрузка…</p>
    </div>
  );
}
