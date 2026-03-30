import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ExecutorOrdersSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="overflow-hidden p-4">
            <Skeleton className="h-5 w-[66%] max-w-md" />
            <Skeleton className="mt-2 h-4 w-40" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
