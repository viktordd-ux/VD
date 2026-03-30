import type { OrderPriorityLevel } from "@/lib/order-priority";
import { orderPriorityLabel } from "@/lib/order-priority";
import { cn } from "@/lib/cn";

const dot: Record<OrderPriorityLevel, string> = {
  low: "bg-zinc-300",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

export function OrderPriorityIndicator({
  level,
  className,
  showLabel = false,
}: {
  level: OrderPriorityLevel;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={orderPriorityLabel[level]}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full ring-2 ring-white transition-colors duration-200",
          dot[level],
        )}
        aria-hidden
      />
      {showLabel ? (
        <span className="text-[11px] font-medium text-zinc-500">{orderPriorityLabel[level]}</span>
      ) : null}
    </span>
  );
}
