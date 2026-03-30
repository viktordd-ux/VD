"use client";

import { createContext, useContext } from "react";

export type QuickCreateContextValue = {
  open: () => void;
};

export const QuickCreateContext = createContext<QuickCreateContextValue | null>(
  null,
);

export function useQuickCreate() {
  return useContext(QuickCreateContext);
}
