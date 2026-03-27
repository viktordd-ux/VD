import type { OrderRiskFlags } from "@/lib/order-risk";
import { hasAnyRed, hasAnyYellow } from "@/lib/order-risk";

export function OrderRiskBadges({ flags }: { flags: OrderRiskFlags }) {
  if (!hasAnyRed(flags) && !hasAnyYellow(flags)) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {flags.redRevisions && (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Много правок
        </span>
      )}
      {flags.redDeadline && (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Дедлайн
        </span>
      )}
      {flags.yellowCheckpoint && (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
          Чекпоинт просрочен
        </span>
      )}
      {flags.yellowSilent && (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
          Нет активности
        </span>
      )}
      {flags.redSilent && (
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          Долгая тишина
        </span>
      )}
    </div>
  );
}
