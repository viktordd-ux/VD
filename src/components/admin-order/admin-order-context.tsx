"use client";

import type { Checkpoint, File } from "@prisma/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  normalizeOrderForClient,
  type OrderWithRelations,
} from "@/lib/order-client-deserialize";

export type { OrderWithRelations };

type Ctx = {
  order: OrderWithRelations;
  setOrder: React.Dispatch<React.SetStateAction<OrderWithRelations>>;
  checkpoints: Checkpoint[];
  setCheckpoints: React.Dispatch<React.SetStateAction<Checkpoint[]>>;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  historyVersion: number;
  bumpHistory: () => void;
};

const AdminOrderContext = createContext<Ctx | null>(null);

export function AdminOrderProvider({
  children,
  initialOrder,
  initialCheckpoints,
  initialFiles,
  /** Сдвигается при обновлении кэша React Query (realtime / refetch) — синхронизация с сервером. */
  bundleRevision,
}: {
  children: ReactNode;
  initialOrder: OrderWithRelations;
  initialCheckpoints: Checkpoint[];
  initialFiles: File[];
  bundleRevision: number;
}) {
  const [order, setOrder] = useState(() => normalizeOrderForClient(initialOrder));
  const [checkpoints, setCheckpoints] = useState(initialCheckpoints);
  const [files, setFiles] = useState(initialFiles);
  const [historyVersion, setHistoryVersion] = useState(0);
  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  useEffect(() => {
    setOrder(normalizeOrderForClient(initialOrder));
    setCheckpoints(initialCheckpoints);
    setFiles(initialFiles);
  }, [bundleRevision]);

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

  return <AdminOrderContext.Provider value={value}>{children}</AdminOrderContext.Provider>;
}

export function useAdminOrder() {
  const ctx = useContext(AdminOrderContext);
  if (!ctx) throw new Error("useAdminOrder must be used within AdminOrderProvider");
  return ctx;
}
