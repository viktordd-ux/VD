"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
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

function OnboardingHintsBanner() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem("vd:onboarding-hints-dismissed") === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed) return null;
  return (
    <div
      className={cn(
        "vd-fade-in rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-4 py-3 text-sm dark:bg-blue-500/10",
      )}
      role="note"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-[var(--text)]">Подсказки</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed text-[var(--muted)]">
            <li>Чат по заказу — на странице заказа; сообщения и вложения в одном потоке.</li>
            <li>Уведомления — иконка колокольчика в шапке; откройте событие, чтобы перейти к заказу или чату.</li>
          </ul>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-[color:var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium transition hover:bg-[color:var(--muted-bg)] active:scale-[0.98]"
          onClick={() => {
            try {
              localStorage.setItem("vd:onboarding-hints-dismissed", "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}

function filterSummaryFromView(
  v: AdminOrderListViewSnapshot,
  teams: { id: string; name: string }[],
): string[] {
  const filterSummary: string[] = [];
  if (v.teamId) {
    const tn = teams.find((t) => t.id === v.teamId)?.name;
    if (tn) filterSummary.push(`команда: ${tn}`);
  }
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
      team: searchParams.get("team") ?? "",
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

  const filterSummary = filterSummaryFromView(
    data.viewSnapshot,
    data.teams ?? [],
  );

  return (
    <OrdersBulkProvider>
      <div className="vd-page-enter space-y-6">
        <OrdersFilterHydration />
        <OnboardingHintsBanner />
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="vd-page-title text-3xl">Заказы</h1>
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
          teams={data.teams ?? []}
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
