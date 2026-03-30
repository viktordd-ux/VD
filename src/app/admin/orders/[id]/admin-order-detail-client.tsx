"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AdminOrderDetailSkeleton } from "@/components/skeletons/admin-order-detail-skeleton";
import { fetchAdminOrderBundle } from "@/lib/admin-order-bundle-fetch";
import { AdminCompleteAllCheckpoints } from "@/components/admin-complete-all-checkpoints";
import { AdminCheckpointsPanel } from "@/components/admin-checkpoints-panel";
import { AdminOrderProvider } from "@/components/admin-order/admin-order-context";
import { AdminOrderRealtime } from "@/components/admin-order/admin-order-realtime";
import { AdminOrderFilesSection } from "@/components/admin-order/admin-order-files-section";
import { AdminOrderHistoryTabs } from "@/components/admin-order/admin-order-history-tabs";
import { AdminOrderSummaryCard } from "@/components/admin-order/admin-order-summary-card";
import { Card } from "@/components/ui/card";
import { OrderProjectReadMarker } from "@/components/order-project-read-marker";
import { OrderChat } from "@/components/order-chat/order-chat";
import { queryKeys } from "@/lib/query-keys";
import { AdminOrderForm } from "./ui";
import { AdminOrderDelete } from "./admin-order-delete";

export function AdminOrderDetailClient({ orderId }: { orderId: string }) {
  const { data, isPending, isError, error, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.adminOrder(orderId),
    queryFn: () => fetchAdminOrderBundle(orderId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isPending) {
    return <AdminOrderDetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {(error as Error)?.message ?? "Ошибка загрузки"}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        Заказ не найден
      </div>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return (
    <AdminOrderProvider
      initialOrder={data.order}
      initialCheckpoints={data.checkpoints}
      initialFiles={data.files}
      bundleRevision={dataUpdatedAt}
    >
      <OrderProjectReadMarker orderId={orderId} />
      <AdminOrderRealtime
        orderId={orderId}
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
      />
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/orders"
          className="inline-flex min-h-11 items-center text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800 md:min-h-0"
          prefetch
        >
          ← Заказы
        </Link>

        <div className="mt-8 flex min-w-0 flex-col gap-8 lg:gap-10">
          <AdminOrderSummaryCard />

          <AdminOrderForm executors={data.executors} executorStats={data.executorStats} />

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <Card className="p-5 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Этапы</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Когда все этапы выполнены при статусе «В работе», заказ переходит на проверку.
                  </p>
                </div>
                <AdminCompleteAllCheckpoints orderId={orderId} />
              </div>
              <div className="mt-5">
                <AdminCheckpointsPanel
                  orderId={orderId}
                  supabaseUrl={supabaseUrl}
                  supabaseAnonKey={supabaseAnonKey}
                />
              </div>
            </Card>

            <Card className="p-5 md:p-6">
              <AdminOrderFilesSection orderId={orderId} />
            </Card>
          </div>

          <AdminOrderDelete orderId={orderId} />

          <Card className="p-5 md:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">История и аудит</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Хронология изменений, этапов и записей аудита по заказу.
            </p>
            <div className="mt-5">
              <AdminOrderHistoryTabs orderId={orderId} />
            </div>
          </Card>
        </div>

        <OrderChat
          orderId={orderId}
          variant="dock"
          initialHasUnreadChat={data.initialChatUnread}
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
        />
      </div>
    </AdminOrderProvider>
  );
}
