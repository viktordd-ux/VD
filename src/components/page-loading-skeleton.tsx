import { Skeleton } from "@/components/ui/skeleton";

/** Общий вид «страница грузится» — без спиннеров, только скелетон. */
export function PageLoadingSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex flex-col gap-3 py-8"
          : "flex min-h-[min(60vh,28rem)] w-full flex-col gap-5 px-4 py-12 md:px-0"
      }
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 max-w-[80%] rounded-lg" />
        <Skeleton className="h-4 w-full max-w-md rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
