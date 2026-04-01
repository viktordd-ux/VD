import { Skeleton } from "@/components/ui/skeleton";

function IssueRowSkeleton() {
  return (
    <div className="flex min-h-[3.25rem] items-center gap-3 border-b border-[color:var(--border)] px-2 py-3 last:border-b-0 md:gap-4">
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
      <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-[min(100%,18rem)] max-w-full" />
        <Skeleton className="h-3 w-[min(100%,28rem)] max-w-full" />
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:hidden">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function OrdersListSkeleton() {
  return (
    <div className="vd-fade-in space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-10 w-full max-w-xs rounded-md sm:w-48" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-sm shadow-black/[0.04] dark:shadow-black/30">
        <div className="divide-y divide-[color:var(--border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <IssueRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
