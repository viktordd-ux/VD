"use client";

import { OrderHistoryTabs } from "@/components/order-history-tabs";
import { useAdminOrder } from "./admin-order-context";

export function AdminOrderHistoryTabs({ orderId }: { orderId: string }) {
  const { historyVersion } = useAdminOrder();
  return <OrderHistoryTabs orderId={orderId} historyVersion={historyVersion} />;
}
