"use client";

import { createContext, useContext } from "react";
import type { Checkpoint } from "@prisma/client";

export type AdminOrdersListActions = {
  patchOrderFromAdminApi: (orderId: string, json: Record<string, unknown>) => void;
  removeOrder: (orderId: string) => void;
  removeOrders: (ids: string[]) => void;
  setOrderCheckpoints: (orderId: string, checkpoints: Checkpoint[]) => void;
  patchOrderStatus: (orderId: string, status: string) => void;
};

const Ctx = createContext<AdminOrdersListActions | null>(null);

export function useAdminOrdersListActions(): AdminOrdersListActions | null {
  return useContext(Ctx);
}

export function AdminOrdersListActionsProvider({
  value,
  children,
}: {
  value: AdminOrdersListActions;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
