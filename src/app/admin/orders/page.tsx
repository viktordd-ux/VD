import type { Prisma } from "@prisma/client";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import { orderIsActive } from "@/lib/active-scope";
import {
  computeFlags,
  isLowMargin,
  marginRatio,
  matchesDeadlineRange,
  matchesRiskFilters,
  matchesSkills,
  matchesStatus,
  parseCsv,
  sortOrders,
  type OrderListSort,
  type OrderWithRelations,
} from "@/lib/order-list-filters";
import { OrderRowQuickActions } from "./order-row-actions";
import {
  OrdersBulkCheckbox,
  OrdersBulkProvider,
  OrdersBulkToolbar,
} from "./orders-bulk";
import { QuickCreateOrderButton } from "./quick-create-order";
import { OrdersFilterForm } from "./orders-filter-form";
import { OrdersFilterHydration } from "./orders-filter-hydration";

export const dynamic = "force-dynamic";

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

  const executorsForSkills = await prisma.user.findMany({
    where: { role: "executor", status: "active" },
    select: { skills: true },
  });
  const allSkills = [
    ...new Set(executorsForSkills.flatMap((u) => u.skills)),
  ].sort((a, b) => a.localeCompare(b, "ru"));

  const templates = await prisma.orderTemplate.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  let orders = (await prisma.order.findMany({
    where,
    include: { executor: true, checkpoints: true, files: true },
    orderBy: { updatedAt: "desc" },
  })) as OrderWithRelations[];

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
  const sortHref = (nextSort: OrderListSort) => {
    const p = new URLSearchParams(baseParams);
    p.set("sort", nextSort);
    return `/admin/orders?${p.toString()}`;
  };

  return (
    <OrdersBulkProvider>
    <div className="space-y-6">
      <OrdersFilterHydration />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Заказы</h1>
          {filterSummary.length > 0 && (
            <p className="mt-1 text-sm text-zinc-600">{filterSummary.join(" · ")}</p>
          )}
        </div>
        <QuickCreateOrderButton templates={templates} />
      </div>

      <OrdersFilterForm
        key={JSON.stringify(initial)}
        allSkills={allSkills}
        initial={initial}
      />

      <OrdersBulkToolbar />

      {orders.length === 0 ? (
        <EmptyState
          title="Нет заказов по выбранным условиям"
          description="Измените фильтры или создайте новый заказ."
          action={
            <QuickCreateOrderButton templates={templates} label="Создать заказ" />
          }
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/90">
              <tr>
                <th className={`${thClass} w-10`} aria-label="Выбор" />
                <th className={thClass}>Название</th>
                <th className={thClass}>Клиент</th>
                <th className={thClass}>Статус</th>
                <th className={thClass}>Исполнитель</th>
                <th className={thClass}>
                  <Link href={sortHref(sort === "deadline_asc" ? "deadline_desc" : "deadline_asc")}>
                    Дедлайн
                  </Link>
                </th>
                <th className={thClass}>
                  <Link href={sortHref(sort === "profit_desc" ? "profit_asc" : "profit_desc")}>
                    Прибыль
                  </Link>
                </th>
                <th className={thClass}>
                  <Link href={sortHref(sort === "margin_desc" ? "margin_asc" : "margin_desc")}>
                    Маржа %
                  </Link>
                </th>
                <th className={thClass}>Обновлён</th>
                <th className={`${thClass} w-[200px]`}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={trClass}>
                  <td className={`${tdClass} align-middle`}>
                    <OrdersBulkCheckbox orderId={o.id} />
                  </td>
                  <td className={tdClass}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {o.title}
                    </Link>
                  </td>
                  <td className={tdClass}>{o.clientName}</td>
                  <td className={tdClass}>
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className={tdClass}>{o.executor?.name ?? "—"}</td>
                  <td className={`${tdClass} tabular-nums text-zinc-600`}>
                    {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>{o.profit.toString()}</td>
                  <td className={`${tdClass} tabular-nums text-zinc-700`}>
                    {(marginRatio(o) * 100).toFixed(1)}%
                  </td>
                  <td className={`${tdClass} tabular-nums text-xs text-zinc-500`}>
                    {o.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className={`${tdClass} align-top`}>
                    <OrderRowQuickActions
                      orderId={o.id}
                      status={o.status}
                      checkpointCount={o.checkpoints.length}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
    </OrdersBulkProvider>
  );
}
