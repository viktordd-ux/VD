"use client";

import type { User } from "@prisma/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { OrderWithRelations } from "@/lib/order-list-filters";

/** Кэш исполнителя для UI (без join из Realtime). */
export type ExecutorCacheEntry = {
  id: string;
  name: string;
  email: string;
  skills: string[];
  primarySkill: string;
  /** Рейтинг 0–100 (агрегат по завершённым заказам) */
  rating: number;
  completedOrders: number;
  latePercent: number;
  /** Средний срок выполнения, ч */
  avgResponseTime: number | null;
};

function parseExecutorUserRow(row: Record<string, unknown>): ExecutorCacheEntry | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    primarySkill: String(row.primary_skill ?? row.primarySkill ?? ""),
    rating: Number(row.rating ?? 0),
    completedOrders: Number(row.completed_orders ?? row.completedOrders ?? 0),
    latePercent: Number(row.late_percent ?? row.latePercent ?? 0),
    avgResponseTime: (() => {
      const raw = row.avg_response_time ?? row.avgResponseTime;
      if (raw == null || raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })(),
  };
}

function apiUserToEntry(u: {
  id: string;
  name: string;
  email: string;
  skills: string[];
  primarySkill: string;
  rating?: number;
  completedOrders?: number;
  latePercent?: number;
  avgResponseTime?: number | null;
}): ExecutorCacheEntry {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    skills: u.skills,
    primarySkill: u.primarySkill,
    rating: u.rating ?? 0,
    completedOrders: u.completedOrders ?? 0,
    latePercent: u.latePercent ?? 0,
    avgResponseTime: u.avgResponseTime ?? null,
  };
}

/** Подставляет executor из кэша для фильтров (навыки), если в заказе только executor_id. */
export function enrichOrderWithExecutorMap(
  o: OrderWithRelations,
  map: Record<string, ExecutorCacheEntry>,
): OrderWithRelations {
  if (!o.executorId || o.executor) return o;
  const c = map[o.executorId];
  if (!c) return o;
  return { ...o, executor: userStubFromExecutorCache(c) };
}

export function userStubFromExecutorCache(e: ExecutorCacheEntry): User {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    firstName: "",
    lastName: "",
    passwordHash: "",
    role: "executor",
    status: "active",
    phone: null,
    telegram: null,
    telegramId: null,
    skills: e.skills,
    primarySkill: e.primarySkill,
    onboarded: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

type Ctx = {
  executorsMap: Record<string, ExecutorCacheEntry>;
  isLoading: boolean;
  /** Имя для отображения: кэш → fallback (напр. order.executor) → «—» */
  getExecutorDisplayName: (
    executorId: string | null | undefined,
    fallbackName?: string | null,
  ) => string;
  getEntry: (executorId: string | null | undefined) => ExecutorCacheEntry | undefined;
  refresh: () => Promise<void>;
};

const ExecutorsContext = createContext<Ctx | null>(null);

export function ExecutorsProvider({ children }: { children: ReactNode }) {
  const [executorsMap, setExecutorsMap] = useState<Record<string, ExecutorCacheEntry>>({});
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (!res.ok) {
      setIsLoading(false);
      return;
    }
    const list = (await res.json()) as Array<{
      id: string;
      name: string;
      email: string;
      skills: string[];
      primarySkill: string;
      rating?: number;
      completedOrders?: number;
      latePercent?: number;
      avgResponseTime?: number | null;
    }>;
    const next: Record<string, ExecutorCacheEntry> = {};
    for (const u of list) {
      next[u.id] = apiUserToEntry(u);
    }
    setExecutorsMap(next);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    function handleUser(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const id = old?.id ? String(old.id) : null;
        if (!id) return;
        setExecutorsMap((prev) => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
        return;
      }
      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const id = String(row.id ?? "");
      if (!id) return;
      if (String(row.role ?? "") !== "executor") {
        setExecutorsMap((prev) => {
          if (!(id in prev)) return prev;
          const { [id]: _, ...rest } = prev;
          return rest;
        });
        return;
      }
      const entry = parseExecutorUserRow(row);
      if (!entry) return;
      setExecutorsMap((prev) => {
        const prevM = prev[entry.id];
        const merged: ExecutorCacheEntry = {
          ...entry,
          rating: prevM?.rating ?? entry.rating,
          completedOrders: prevM?.completedOrders ?? entry.completedOrders,
          latePercent: prevM?.latePercent ?? entry.latePercent,
          avgResponseTime:
            prevM?.avgResponseTime !== undefined && prevM?.avgResponseTime !== null
              ? prevM.avgResponseTime
              : entry.avgResponseTime,
        };
        return { ...prev, [entry.id]: merged };
      });
    }

    const channel = supabase
      .channel("admin-executors-users")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: "role=eq.executor",
        },
        handleUser,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const getEntry = useCallback((executorId: string | null | undefined) => {
    if (!executorId) return undefined;
    return executorsMap[executorId];
  }, [executorsMap]);

  const getExecutorDisplayName = useCallback(
    (executorId: string | null | undefined, fallbackName?: string | null) => {
      if (!executorId) return fallbackName?.trim() || "—";
      const n = executorsMap[executorId]?.name?.trim();
      if (n) return n;
      const fb = fallbackName?.trim();
      return fb || "—";
    },
    [executorsMap],
  );

  const value = useMemo(
    () => ({
      executorsMap,
      isLoading,
      getExecutorDisplayName,
      getEntry,
      refresh: load,
    }),
    [executorsMap, isLoading, getExecutorDisplayName, getEntry, load],
  );

  return (
    <ExecutorsContext.Provider value={value}>{children}</ExecutorsContext.Provider>
  );
}

export function useExecutors() {
  const ctx = useContext(ExecutorsContext);
  if (!ctx) {
    throw new Error("useExecutors must be used within ExecutorsProvider");
  }
  return ctx;
}

/** Для компонентов вне провайдера (например тесты) — безопасное чтение. */
export function useExecutorsOptional(): Ctx | null {
  return useContext(ExecutorsContext);
}

/** Короткая строка метрик для списков и карточек. */
export function formatExecutorMetricsLine(e: ExecutorCacheEntry): string {
  const r = e.rating.toFixed(0);
  const n = e.completedOrders;
  const l = e.latePercent.toFixed(0);
  return `⭐ ${r} · ${n} зак. · проср. ${l}%`;
}
