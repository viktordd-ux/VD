import type { OrderStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

const dotClass: Record<OrderStatus, string> = {
  LEAD: "bg-zinc-400",
  IN_PROGRESS: "bg-blue-500",
  REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
};

export function OrderStatusDot({
  status,
  className,
  title,
}: {
  status: OrderStatus;
  className?: string;
  /** Для доступности при отсутствии подписи рядом */
  title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full ring-2 ring-white",
        dotClass[status],
        "transition-[background-color,box-shadow] duration-200 ease-out will-change-[background-color]",
        className,
      )}
      title={title}
      aria-hidden
    />
  );
}
