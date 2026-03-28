"use client";

import { OrderHistoryTabs } from "@/components/order-history-tabs";
import { useExecutorOrder } from "./executor-order-context";

export function ExecutorOrderHistoryTabs({ orderId }: { orderId: string }) {
  const { historyVersion } = useExecutorOrder();
  return <OrderHistoryTabs orderId={orderId} historyVersion={historyVersion} />;
}
