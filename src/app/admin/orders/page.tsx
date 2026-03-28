import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { orderIsActive } from "@/lib/active-scope";
import {
  computeFlags,
  isLowMargin,
  matchesDeadlineRange,
  matchesRiskFilters,
  matchesSkills,
  matchesStatus,
  parseCsv,
  sortOrders,
  type OrderListSort,
  type OrderWithRelations,
} from "@/lib/order-list-filters";
import {
  OrdersBulkProvider,
  OrdersBulkToolbar,
} from "./orders-bulk";
import { QuickCreateOrderButton } from "./quick-create-order";
import { OrdersFilterForm } from "./orders-filter-form";
import { OrdersFilterHydration } from "./orders-filter-hydration";
import { AdminOrdersListClient } from "./admin-orders-list-client";
import {
  serializeOrdersForListClient,
} from "@/lib/order-list-client-serialize";
import type { AdminOrderListViewSnapshot } from "@/lib/order-list-filters";

export const dynamic = "force-dynamic";
/** Vercel: тяжёлый findMany по заказам; на Pro можно увеличить лимит времени функции. */
export const maxDuration = 60;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filter = sp.filter ?? "active";
  const lowMargin = sp.lowMargin === "1";
  const skillsFilter = parseCsv(sp.skills);
  const statusFilter = parseCsv(sp.status);
  const riskFilter = parseCsv(sp.risk);
  const sort = (sp.sort as OrderListSort) ?? "updated_desc";
  const deadlineAfter = sp.deadlineAfter ?? "";
  const deadlineBefore = sp.deadlineBefore ?? "";
  const skillsMode = sp.skillsMode === "all" ? "all" : "any";

  const where: Prisma.OrderWhereInput =
    filter === "active"
      ? { ...orderIsActive, status: { not: "DONE" } }
      : filter === "done"
        ? { ...orderIsActive, status: "DONE" }
        : { ...orderIsActive };

  /**
   * Интерактивная транзакция: maxWait/timeout задаются во втором аргументе.
   * У batch-массива $transaction([...]) в Prisma 5 в опциях только isolationLevel — дефолтный maxWait ~2 с.
   */
  const [executorsForSkills, templates, ordersRaw] = await prisma.$transaction(
    async (tx) => {
      const ex = await tx.user.findMany({
        where: { role: "executor", status: "active" },
        select: { skills: true },
      });
      const tpl = await tx.orderTemplate.findMany({
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      });
      const ord = await tx.order.findMany({
        where,
        include: { executor: true, checkpoints: true, files: true },
        orderBy: { updatedAt: "desc" },
      });
      return [ex, tpl, ord] as const;
    },
    { maxWait: 60_000, timeout: 120_000 },
  );

  const allSkills = [
    ...new Set(executorsForSkills.flatMap((u) => u.skills)),
  ].sort((a, b) => a.localeCompare(b, "ru"));

  let orders = ordersRaw as OrderWithRelations[];

  if (lowMargin) {
    orders = orders.filter(isLowMargin);
  }
  if (skillsFilter.length) {
    orders = orders.filter((o) =>
      matchesSkills(o.executor, skillsFilter, skillsMode),
    );
  }
  if (statusFilter.length) {
    orders = orders.filter((o) => matchesStatus(o, statusFilter));
  }
  if (riskFilter.length) {
    orders = orders.filter((o) => {
      const flags = computeFlags(o);
      return matchesRiskFilters(flags, riskFilter);
    });
  }
  if (deadlineAfter || deadlineBefore) {
    orders = orders.filter((o) =>
      matchesDeadlineRange(o, deadlineAfter, deadlineBefore),
    );
  }

  orders = sortOrders(orders, sort);

  const initial = {
    filter,
    lowMargin,
    skills: skillsFilter,
    status: statusFilter,
    risk: riskFilter,
    sort,
    deadlineAfter,
    deadlineBefore,
    skillsMode: skillsMode as "any" | "all",
  };

  const filterSummary: string[] = [];
  if (lowMargin) filterSummary.push("маржа < 50%");
  if (skillsFilter.length) {
    filterSummary.push(
      `навыки (${skillsMode === "all" ? "все" : "любой"}): ${skillsFilter.join(", ")}`,
    );
  }
  if (statusFilter.length) filterSummary.push(`статус: ${statusFilter.join(", ")}`);
  if (riskFilter.length) filterSummary.push(`риски: ${riskFilter.length}`);
  if (deadlineAfter || deadlineBefore) {
    filterSummary.push(
      `дедлайн ${deadlineAfter || "…"} — ${deadlineBefore || "…"}`,
    );
  }

  const baseParams = new URLSearchParams();
  if (filter && filter !== "active") baseParams.set("filter", filter);
  if (lowMargin) baseParams.set("lowMargin", "1");
  if (skillsFilter.length) baseParams.set("skills", skillsFilter.join(","));
  if (statusFilter.length) baseParams.set("status", statusFilter.join(","));
  if (riskFilter.length) baseParams.set("risk", riskFilter.join(","));
  if (deadlineAfter) baseParams.set("deadlineAfter", deadlineAfter);
  if (deadlineBefore) baseParams.set("deadlineBefore", deadlineBefore);
  if (skillsMode === "all") baseParams.set("skillsMode", "all");

  const viewSnapshot: AdminOrderListViewSnapshot = {
    filter: filter === "active" ? "active" : filter === "done" ? "done" : "all",
    lowMargin,
    skillsFilter,
    statusFilter,
    riskFilter,
    deadlineAfter,
    deadlineBefore,
    skillsMode,
  };

  return (
    <OrdersBulkProvider>
    <div className="space-y-6">
      <OrdersFilterHydration />
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Заказы</h1>
          {filterSummary.length > 0 && (
            <p className="mt-1 text-sm text-zinc-600">{filterSummary.join(" · ")}</p>
          )}
        </div>
        <div className="w-full shrink-0 sm:w-auto [&_button]:w-full [&_button]:sm:w-auto">
          <QuickCreateOrderButton templates={templates} />
        </div>
      </div>

      <OrdersFilterForm
        key={JSON.stringify(initial)}
        allSkills={allSkills}
        initial={initial}
      />

      <OrdersBulkToolbar />

      <AdminOrdersListClient
        initialSerialized={serializeOrdersForListClient(orders)}
        viewSnapshot={viewSnapshot}
        sort={sort}
        baseUrlParams={baseParams.toString()}
        templates={templates}
      />
    </div>
    </OrdersBulkProvider>
  );
}
