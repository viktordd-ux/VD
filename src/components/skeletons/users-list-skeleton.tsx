import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function UsersListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Card className="overflow-hidden">
        <div className="divide-y divide-[color:var(--border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-wrap items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
