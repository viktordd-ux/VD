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
import { OrderLiveRefresh } from "@/components/order-live-refresh";
import { Card } from "@/components/ui/card";
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
      <OrderLiveRefresh />
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

      {orders.length === 0 ? (
        <EmptyState
          title="Нет заказов по выбранным условиям"
          description="Измените фильтры или создайте новый заказ."
          action={
            <QuickCreateOrderButton templates={templates} label="Создать заказ" />
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
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
          </div>

          <div className="space-y-3 md:hidden">
            {orders.map((o) => (
              <Card key={o.id} className="overflow-hidden p-4 shadow-sm">
                <div className="flex items-start gap-3 border-b border-zinc-100 pb-3">
                  <OrdersBulkCheckbox orderId={o.id} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-base font-semibold text-blue-600 hover:underline"
                    >
                      {o.title}
                    </Link>
                    <p className="mt-1 text-sm text-zinc-600">{o.clientName}</p>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Исполнитель</dt>
                    <dd className="max-w-[60%] text-right font-medium text-zinc-900">
                      {o.executor?.name ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Дедлайн</dt>
                    <dd className="tabular-nums text-zinc-800">
                      {o.deadline ? o.deadline.toISOString().slice(0, 10) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Прибыль</dt>
                    <dd className="tabular-nums font-medium">{o.profit.toString()}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Маржа</dt>
                    <dd className="tabular-nums text-zinc-700">
                      {(marginRatio(o) * 100).toFixed(1)}%
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 text-xs">
                    <dt className="text-zinc-500">Обновлён</dt>
                    <dd className="tabular-nums text-zinc-500">
                      {o.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-zinc-100 pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Действия
                  </p>
                  <OrderRowQuickActions
                    orderId={o.id}
                    status={o.status}
                    checkpointCount={o.checkpoints.length}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
    </OrdersBulkProvider>
  );
}
