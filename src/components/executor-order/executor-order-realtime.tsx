"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  parseCheckpointRowFromSupabase,
  parseFileRowFromSupabase,
  parseOrderRowFromSupabase,
  sortCheckpointsForUi,
} from "@/lib/supabase-realtime-parsers";
import { useExecutorOrder } from "./executor-order-context";

export function ExecutorOrderRealtime({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}) {
  const router = useRouter();
  const { setOrder, setCheckpoints, setFiles, bumpHistory } = useExecutorOrder();
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    function applyOrderRow(row: Record<string, unknown>) {
      const parsed = parseOrderRowFromSupabase(row);
      if (!parsed) return;
      if (parsed.deletedAt) {
        router.push("/executor");
        return;
      }
      if (parsed.executorId !== userIdRef.current) {
        router.push("/executor");
        return;
      }
      setOrder((o) => ({ ...o, ...parsed }));
      bumpHistory();
    }

    function handleOrderPayload(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      if (payload.eventType === "DELETE") {
        router.push("/executor");
        return;
      }
      const row = payload.new as Record<string, unknown> | null;
      if (row) applyOrderRow(row);
    }

    function handleCheckpointPayload(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const id = old?.id ? String(old.id) : null;
        if (!id) return;
        setCheckpoints((prev) => prev.filter((c) => c.id !== id));
        bumpHistory();
        return;
      }
      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const c = parseCheckpointRowFromSupabase(row);
      if (!c) return;
      if (payload.eventType === "INSERT") {
        setCheckpoints((prev) => {
          if (prev.some((x) => x.id === c.id)) return prev;
          return sortCheckpointsForUi([...prev, c]);
        });
        bumpHistory();
        return;
      }
      setCheckpoints((prev) => {
        const next = prev.some((x) => x.id === c.id)
          ? prev.map((x) => (x.id === c.id ? c : x))
          : [...prev, c];
        return sortCheckpointsForUi(next);
      });
      bumpHistory();
    }

    function handleFilePayload(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const id = old?.id ? String(old.id) : null;
        if (!id) return;
        setFiles((prev) => prev.filter((f) => f.id !== id));
        bumpHistory();
        return;
      }
      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const f = parseFileRowFromSupabase(row);
      if (!f) return;
      if (payload.eventType === "INSERT") {
        setFiles((prev) => {
          if (prev.some((x) => x.id === f.id)) return prev;
          return [f, ...prev];
        });
        bumpHistory();
        return;
      }
      setFiles((prev) => prev.map((x) => (x.id === f.id ? f : x)));
      bumpHistory();
    }

    const channel = supabase
      .channel(`order-exec-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        handleOrderPayload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "checkpoints",
          filter: `order_id=eq.${orderId}`,
        },
        handleCheckpointPayload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "files",
          filter: `order_id=eq.${orderId}`,
        },
        handleFilePayload,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, router, setOrder, setCheckpoints, setFiles, bumpHistory]);

  return null;
}
