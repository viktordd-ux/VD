import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function OrderChatSkeleton({ compact }: { compact?: boolean }) {
  return (
    <Card
      className={
        compact
          ? "flex min-h-[12rem] flex-col p-4"
          : "flex min-h-[16rem] flex-col p-4 md:p-6"
      }
    >
      <Skeleton className="h-5 w-32" />
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex justify-end">
          <Skeleton className="h-12 w-[70%] rounded-2xl rounded-br-md" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-14 w-[75%] rounded-2xl rounded-bl-md" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[55%] rounded-2xl rounded-br-md" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-20 rounded-md" />
      </div>
    </Card>
  );
}
