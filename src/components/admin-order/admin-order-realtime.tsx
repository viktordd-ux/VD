"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  applyRealtimeCheckpointToBundleCache,
  applyRealtimeFileToBundleCache,
  applyRealtimeOrderRowToBundleCache,
} from "@/lib/react-query-realtime";
import { queryKeys } from "@/lib/query-keys";
import { parseOrderRowFromSupabase } from "@/lib/supabase-realtime-parsers";
import { useAdminOrder } from "./admin-order-context";

export function AdminOrderRealtime({
  orderId,
  supabaseUrl,
  supabaseAnonKey,
}: {
  orderId: string;
  /** С server page — иначе на проде Realtime не поднимается (пустой NEXT_PUBLIC_* в бандле). */
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { bumpHistory } = useAdminOrder();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient({ supabaseUrl, supabaseAnonKey });
    if (!supabase) return;

    function applyOrderRow(row: Record<string, unknown>) {
      const parsed = parseOrderRowFromSupabase(row);
      if (!parsed) return;
      if (parsed.deletedAt) {
        queryClient.removeQueries({ queryKey: queryKeys.adminOrder(orderId) });
        router.push("/admin/orders");
        return;
      }
      applyRealtimeOrderRowToBundleCache(queryClient, orderId, row);
      bumpHistory();
    }

    function handleOrderPayload(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      if (payload.eventType === "DELETE") {
        queryClient.removeQueries({ queryKey: queryKeys.adminOrder(orderId) });
        router.push("/admin/orders");
        return;
      }
      const row = payload.new as Record<string, unknown> | null;
      if (row) applyOrderRow(row);
    }

    function handleCheckpointPayload(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      applyRealtimeCheckpointToBundleCache(queryClient, orderId, payload);
      bumpHistory();
    }

    function handleFilePayload(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      applyRealtimeFileToBundleCache(queryClient, orderId, payload);
      bumpHistory();
    }

    const channel = supabase
      .channel(`order-admin-${orderId}`)
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
    queryClient,
    supabaseUrl,
    supabaseAnonKey,
    bumpHistory,
  ]);

  return null;
}
