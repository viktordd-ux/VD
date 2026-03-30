"use client";

import { createContext, useContext } from "react";

export type LeadsListMutations = {
  removeLead: (id: string) => void;
  removeLeads: (ids: string[]) => void;
};

const Ctx = createContext<LeadsListMutations | null>(null);

export function useLeadsListMutations(): LeadsListMutations | null {
  return useContext(Ctx);
}

export function LeadsListMutationsProvider({
  value,
  children,
}: {
  value: LeadsListMutations;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
