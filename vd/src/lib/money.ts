import { Decimal } from "@prisma/client/runtime/library";

export function computeProfit(
  budgetClient: Decimal | number | string,
  budgetExecutor: Decimal | number | string,
): Decimal {
  const a = new Decimal(String(budgetClient));
  const b = new Decimal(String(budgetExecutor));
  return a.minus(b);
}
