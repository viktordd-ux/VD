"use client";

import { useQuery } from "@tanstack/react-query";
import { ExecutorOrdersSkeleton } from "@/components/skeletons/executor-orders-skeleton";
import { queryKeys } from "@/lib/query-keys";
import type { SerializedOrderWithRelations } from "@/lib/order-list-client-serialize";
import { ExecutorOrdersListClient } from "./executor-orders-list-client";

type Api = {
  orders: SerializedOrderWithRelations[];
  userId: string;
};

export function ExecutorHomeClient({ userId }: { userId: string }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.executorHome(userId),
    queryFn: async () => {
      const res = await fetch("/api/executor/home-orders");
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Api>;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isPending) {
    return <ExecutorOrdersSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {(error as Error)?.message ?? "Не удалось загрузить задачи"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Мои задачи</h1>
      <ExecutorOrdersListClient initialSerialized={data.orders} userId={data.userId} />
    </div>
  );
}
