"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useInvalidateAdminOrders() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  }, [queryClient]);
}

export function useInvalidateAdminOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    if (!orderId) return;
    void queryClient.invalidateQueries({ queryKey: ["admin", "order", orderId] });
  }, [queryClient, orderId]);
}
