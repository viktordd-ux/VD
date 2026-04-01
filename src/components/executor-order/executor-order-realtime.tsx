"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  parseCheckpointFromApiJson,
  parseExecutorOrderFromApiJson,
} from "@/lib/order-client-deserialize";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  ORDER_SYNC_EVENTS,
  orderSyncChannelName,
} from "@/lib/order-sync-broadcast";
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
  supabaseUrl,
  supabaseAnonKey,
}: {
  orderId: string;
  userId: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const router = useRouter();
  const { setOrder, setCheckpoints, setFiles, bumpHistory } = useExecutorOrder();
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient({ supabaseUrl, supabaseAnonKey });
    if (!supabase) return;

    function applyOrderRow(row: Record<string, unknown>) {
      const parsed = parseOrderRowFromSupabase(row);
      if (!parsed) return;
      if (parsed.deletedAt) {
        router.push("/executor");
        return;
      }
      const uid = userIdRef.current;
      if (parsed.executorId === uid) {
        setOrder((o) => ({
          ...o,
          ...parsed,
          executorUserIds:
            o.executorUserIds?.includes(uid) ? o.executorUserIds : [uid],
        }));
        bumpHistory();
        return;
      }
      void (async () => {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) {
          router.push("/executor");
          return;
        }
        const data = (await res.json()) as Record<string, unknown>;
        const ids = Array.isArray(data.executorUserIds)
          ? (data.executorUserIds as string[])
          : data.executorId
            ? [String(data.executorId)]
            : [];
        if (!ids.includes(uid)) {
          router.push("/executor");
          return;
        }
        setOrder((prev) => parseExecutorOrderFromApiJson(data, { ...prev, executorUserIds: ids }));
        bumpHistory();
      })();
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
  }, [
    orderId,
    router,
    supabaseUrl,
    supabaseAnonKey,
    setOrder,
    setCheckpoints,
    setFiles,
    bumpHistory,
  ]);

  /** Мгновенная синхронизация этапов с админки (Supabase Broadcast), если postgres_changes задерживается. */
  useEffect(() => {
    const supabase = getSupabaseBrowserClient({ supabaseUrl, supabaseAnonKey });
    if (!supabase) return;

    const syncCh = supabase
      .channel(orderSyncChannelName(orderId))
      .on(
        "broadcast",
        { event: ORDER_SYNC_EVENTS.checkpointCreated },
        ({ payload }) => {
          const p = payload as { checkpoint?: Record<string, unknown> };
          if (!p.checkpoint) return;
          const c = parseCheckpointFromApiJson(p.checkpoint);
          setCheckpoints((prev) => {
            if (prev.some((x) => x.id === c.id)) {
              return sortCheckpointsForUi(
                prev.map((x) => (x.id === c.id ? c : x)),
              );
            }
            return sortCheckpointsForUi([...prev, c]);
          });
          bumpHistory();
        },
      )
      .on(
        "broadcast",
        { event: ORDER_SYNC_EVENTS.checkpointUpdated },
        ({ payload }) => {
          const p = payload as { checkpoint?: Record<string, unknown> };
          if (!p.checkpoint) return;
          const c = parseCheckpointFromApiJson(p.checkpoint);
          setCheckpoints((prev) =>
            sortCheckpointsForUi(
              prev.map((x) => (x.id === c.id ? c : x)),
            ),
          );
          bumpHistory();
        },
      )
      .on(
        "broadcast",
        { event: ORDER_SYNC_EVENTS.checkpointDeleted },
        ({ payload }) => {
          const p = payload as { id?: string };
          const id = p.id;
          if (!id) return;
          setCheckpoints((prev) => prev.filter((x) => x.id !== id));
          bumpHistory();
        },
      )
      .on(
        "broadcast",
        { event: ORDER_SYNC_EVENTS.checkpointsRefresh },
        async () => {
          const res = await fetch(`/api/orders/${orderId}/checkpoints`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const raw = (await res.json()) as Record<string, unknown>[];
          setCheckpoints(raw.map((x) => parseCheckpointFromApiJson(x)));
          bumpHistory();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(syncCh);
    };
  }, [
    orderId,
    supabaseUrl,
    supabaseAnonKey,
    setCheckpoints,
    bumpHistory,
  ]);

  return null;
}
