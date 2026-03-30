import type { OrderStatus } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { orderStatusLabel } from "@/lib/ui-labels";

const statusTone: Record<OrderStatus, BadgeTone> = {
  LEAD: "neutral",
  IN_PROGRESS: "progress",
  REVIEW: "review",
  DONE: "success",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span key={status} className="inline-flex vd-status-badge-enter">
      <Badge tone={statusTone[status]}>{orderStatusLabel[status]}</Badge>
    </span>
  );
}
