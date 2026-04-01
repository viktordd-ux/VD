import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Соответствует каркасу `AdminOrderDetailClient`: та же сетка и max-w-6xl, на всю ширину main. */
export function AdminOrderDetailSkeleton() {
  return (
    <div className="w-full max-w-6xl md:mx-auto">
      <Skeleton className="h-4 w-32 rounded-md" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-6">
          <Card className="p-4 md:p-6">
            <Skeleton className="h-7 w-[min(100%,20rem)] max-w-full rounded-md" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md sm:col-span-2" />
            </div>
          </Card>
          <Card className="p-4 md:p-6">
            <Skeleton className="h-5 w-40 rounded-md" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </Card>
          <Card className="p-4 md:p-6">
            <Skeleton className="h-5 w-36 rounded-md" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </Card>
          <Card className="p-4 md:p-6">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="mt-4 h-32 w-full rounded-md" />
          </Card>
        </div>
        <div className="hidden min-w-0 lg:block">
          <Card className="p-4 md:p-5">
            <Skeleton className="h-5 w-24 rounded-md" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
