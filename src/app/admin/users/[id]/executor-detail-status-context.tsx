"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { userStatusLabel } from "@/lib/ui-labels";
import { AdminUserStatusToggle } from "@/components/admin-user-status-toggle";

type Ctx = {
  status: "active" | "banned";
  setStatus: (s: "active" | "banned") => void;
};

const DetailStatusCtx = createContext<Ctx | null>(null);

export function ExecutorDetailStatusProvider({
  initialStatus,
  children,
}: {
  initialStatus: "active" | "banned";
  children: ReactNode;
}) {
  const [status, setStatus] = useState(initialStatus);
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  return (
    <DetailStatusCtx.Provider value={{ status, setStatus }}>{children}</DetailStatusCtx.Provider>
  );
}

function useDetailStatus() {
  const v = useContext(DetailStatusCtx);
  if (!v) throw new Error("ExecutorDetailStatusProvider required");
  return v;
}

export function ExecutorDetailHeaderStatusBadge() {
  const { status } = useDetailStatus();
  return (
    <Badge tone={status === "active" ? "success" : "danger"}>
      {userStatusLabel[status]}
    </Badge>
  );
}

export function ExecutorAccountStatusRow({ userId }: { userId: string }) {
  const { status, setStatus } = useDetailStatus();
  return (
    <>
      <Badge tone={status === "active" ? "success" : "danger"}>
        Статус: {userStatusLabel[status]}
      </Badge>
      <AdminUserStatusToggle
        userId={userId}
        currentStatus={status}
        onSuccess={setStatus}
      />
    </>
  );
}
