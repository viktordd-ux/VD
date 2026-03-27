import type { OrderRiskFlags } from "@/lib/order-risk";
import { hasAnyRed, hasAnyYellow } from "@/lib/order-risk";
import { Badge } from "@/components/ui/badge";

export function OrderRiskBadges({ flags }: { flags: OrderRiskFlags }) {
  if (!hasAnyRed(flags) && !hasAnyYellow(flags)) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {flags.redRevisions && (
        <Badge tone="danger">Много правок</Badge>
      )}
      {flags.redDeadline && (
        <Badge tone="danger">Просрочен дедлайн</Badge>
      )}
      {flags.yellowCheckpoint && (
        <Badge tone="warning">Этап просрочен</Badge>
      )}
      {flags.yellowSilent && (
        <Badge tone="warning">Нет активности</Badge>
      )}
      {flags.redSilent && (
        <Badge tone="danger">Долгая тишина</Badge>
      )}
    </div>
  );
}
