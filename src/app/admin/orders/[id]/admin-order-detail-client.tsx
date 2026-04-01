"use client";

import dynamic from "next/dynamic";
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
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";
import { AdminOrderForm } from "./ui";
import { AdminOrderDelete } from "./admin-order-delete";

const OrderChat = dynamic(
  () =>
    import("@/components/order-chat/order-chat").then((m) => ({
      default: m.OrderChat,
    })),
  { ssr: false, loading: () => null },
);

export function AdminOrderDetailClient({ orderId }: { orderId: string }) {
  const { data, isPending, isError, error, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.adminOrder(orderId),
    queryFn: () => fetchAdminOrderBundle(orderId),
    staleTime: STALE_MS.detail,
    refetchOnWindowFocus: false,
  });

  if (isPending) {
    return <AdminOrderDetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
        {(error as Error)?.message ?? "Ошибка загрузки"}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">
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
      <div className="mx-auto max-w-6xl px-1 md:px-0">
        <Link
          href="/admin/orders"
          className="inline-flex min-h-11 items-center text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)] md:min-h-0"
          prefetch
        >
          ← Заказы
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
          <div className="min-w-0 space-y-6 lg:space-y-8">
            <AdminOrderSummaryCard layout="headerOnly" />

            <AdminOrderForm executors={data.executors} executorStats={data.executorStats} />

            <div className="grid gap-6 lg:grid-cols-1">
              <Card className="border-[color:var(--border)] bg-[var(--card)] p-5 shadow-sm shadow-black/[0.03] dark:shadow-black/30 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Этапы
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
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

              <Card className="border-[color:var(--border)] bg-[var(--card)] p-5 shadow-sm shadow-black/[0.03] dark:shadow-black/30 md:p-6">
                <AdminOrderFilesSection orderId={orderId} />
              </Card>
            </div>

            <AdminOrderDelete orderId={orderId} />

            <Card className="border-[color:var(--border)] bg-[var(--card)] p-5 shadow-sm shadow-black/[0.03] dark:shadow-black/30 md:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                История и аудит
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                Хронология изменений, этапов и записей аудита по заказу.
              </p>
              <div className="mt-5">
                <AdminOrderHistoryTabs orderId={orderId} />
              </div>
            </Card>
          </div>

          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <AdminOrderSummaryCard layout="sidebarOnly" />
          </div>
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
