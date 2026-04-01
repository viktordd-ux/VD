"use client";

import type { Checkpoint, File, Order } from "@prisma/client";

export type ExecutorOrderState = Order & { executorUserIds?: string[] };
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  order: ExecutorOrderState;
  setOrder: React.Dispatch<React.SetStateAction<ExecutorOrderState>>;
  checkpoints: Checkpoint[];
  setCheckpoints: React.Dispatch<React.SetStateAction<Checkpoint[]>>;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  historyVersion: number;
  bumpHistory: () => void;
};

const ExecutorOrderContext = createContext<Ctx | null>(null);

export function ExecutorOrderProvider({
  children,
  initialOrder,
  initialCheckpoints,
  initialFiles,
}: {
  children: ReactNode;
  initialOrder: ExecutorOrderState;
  initialCheckpoints: Checkpoint[];
  initialFiles: File[];
}) {
  const [order, setOrder] = useState(initialOrder);
  const [checkpoints, setCheckpoints] = useState(initialCheckpoints);
  const [files, setFiles] = useState(initialFiles);
  const [historyVersion, setHistoryVersion] = useState(0);
  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({
      order,
      setOrder,
      checkpoints,
      setCheckpoints,
      files,
      setFiles,
      historyVersion,
      bumpHistory,
    }),
    [order, checkpoints, files, historyVersion, bumpHistory],
  );

  return (
    <ExecutorOrderContext.Provider value={value}>{children}</ExecutorOrderContext.Provider>
  );
}

export function useExecutorOrder() {
  const ctx = useContext(ExecutorOrderContext);
  if (!ctx) throw new Error("useExecutorOrder must be used within ExecutorOrderProvider");
  return ctx;
}
