import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminOrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[80rem] space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-4">
        <Card className="p-4 md:p-6">
          <Skeleton className="h-6 w-1/3" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full sm:col-span-2" />
          </div>
        </Card>
        <Card className="p-4 md:p-6">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
        <div className="grid gap-4 2xl:grid-cols-2">
          <Card className="p-4 md:p-6">
            <Skeleton className="h-5 w-24" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </Card>
          <Card className="p-4 md:p-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-4 h-24 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}
