/**
 * Агрегаты прибыли/маржи считаются из заказов в реальном времени (нет отдельной таблицы «финансов»).
 * После soft/hard delete достаточно фильтра deletedAt: null в запросах.
 */
export async function recalculateFinance(): Promise<void> {
  await Promise.resolve();
}
