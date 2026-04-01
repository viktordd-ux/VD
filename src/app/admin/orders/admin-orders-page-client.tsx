"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { OrdersListSkeleton } from "@/components/skeletons/orders-list-skeleton";
import {
  type AdminOrderListViewSnapshot,
  type OrderListSort,
  parseCsv,
} from "@/lib/order-list-filters";
import { useAdminOrdersListQuery } from "@/hooks/use-admin-orders-list-query";
import { useInvalidateAdminOrders } from "@/hooks/use-invalidate-admin-orders";
import { AdminOrdersListClient } from "./admin-orders-list-client";
import { OrdersBulkProvider, OrdersBulkToolbar } from "./orders-bulk";
import { OrdersFilterForm } from "./orders-filter-form";
import { OrdersFilterHydration } from "./orders-filter-hydration";
import { QuickCreateOrderButton } from "./quick-create-order";

function filterSummaryFromView(
  v: AdminOrderListViewSnapshot,
): string[] {
  const filterSummary: string[] = [];
  if (v.lowMargin) filterSummary.push("маржа < 50%");
  if (v.skillsFilter.length) {
    filterSummary.push(
      `навыки (${v.skillsMode === "all" ? "все" : "любой"}): ${v.skillsFilter.join(", ")}`,
    );
  }
  if (v.statusFilter.length) filterSummary.push(`статус: ${v.statusFilter.join(", ")}`);
  if (v.riskFilter.length) filterSummary.push(`риски: ${v.riskFilter.length}`);
  if (v.deadlineAfter || v.deadlineBefore) {
    filterSummary.push(
      `дедлайн ${v.deadlineAfter || "…"} — ${v.deadlineBefore || "…"}`,
    );
  }
  return filterSummary;
}

export function AdminOrdersPageClient() {
  const searchParams = useSearchParams();
  const spString = searchParams.toString();
  const invalidateOrders = useInvalidateAdminOrders();

  const { data, isPending, isError, error } = useAdminOrdersListQuery(spString);

  const initial = useMemo(
    () => ({
      filter: searchParams.get("filter") ?? "active",
      lowMargin: searchParams.get("lowMargin") === "1",
      skills: parseCsv(searchParams.get("skills") ?? undefined),
      status: parseCsv(searchParams.get("status") ?? undefined),
      risk: parseCsv(searchParams.get("risk") ?? undefined),
      sort: (searchParams.get("sort") as OrderListSort) ?? "updated_desc",
      deadlineAfter: searchParams.get("deadlineAfter") ?? "",
      deadlineBefore: searchParams.get("deadlineBefore") ?? "",
      skillsMode: (searchParams.get("skillsMode") === "all" ? "all" : "any") as "any" | "all",
      priority: searchParams.get("priority") ?? "",
    }),
    [searchParams],
  );

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {(error as Error)?.message ?? "Не удалось загрузить заказы"}
      </div>
    );
  }

  if (isPending && !data) {
    return <OrdersListSkeleton />;
  }

  if (!data) {
    return <OrdersListSkeleton />;
  }

  const filterSummary = filterSummaryFromView(data.viewSnapshot);

  return (
    <OrdersBulkProvider>
      <div className="vd-page-enter space-y-6">
        <OrdersFilterHydration />
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">Заказы</h1>
            {filterSummary.length > 0 && (
              <p className="mt-1 text-sm text-[var(--muted)]">{filterSummary.join(" · ")}</p>
            )}
          </div>
          <div className="w-full shrink-0 sm:w-auto [&_button]:w-full [&_button]:sm:w-auto">
            <QuickCreateOrderButton
              templates={data.templates}
              onCreated={invalidateOrders}
            />
          </div>
        </div>

        <OrdersFilterForm
          key={JSON.stringify(initial)}
          allSkills={data.allSkills}
          initial={initial}
        />

        <AdminOrdersListClient
          spString={spString}
          baseUrlParams={data.baseUrlParams}
          templates={data.templates}
        >
          <OrdersBulkToolbar onMutateSuccess={invalidateOrders} />
        </AdminOrdersListClient>
      </div>
    </OrdersBulkProvider>
  );
}
