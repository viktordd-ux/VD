import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getOrderAccessWhereInput } from "@/lib/order-access";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
import { dbUnavailableUserMessage } from "@/lib/db-unavailable-message";
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
import { serializeOrdersForListClient } from "@/lib/order-list-client-serialize";
import type { AdminOrderListViewSnapshot } from "@/lib/order-list-filters";

export async function GET(req: Request) {
  const admin = await requireUser();
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "active";
  const lowMargin = searchParams.get("lowMargin") === "1";
  const skillsFilter = parseCsv(searchParams.get("skills") ?? undefined);
  const statusFilter = parseCsv(searchParams.get("status") ?? undefined);
  const riskFilter = parseCsv(searchParams.get("risk") ?? undefined);
  const sort = (searchParams.get("sort") as OrderListSort) ?? "updated_desc";
  const deadlineAfter = searchParams.get("deadlineAfter") ?? "";
  const deadlineBefore = searchParams.get("deadlineBefore") ?? "";
  const skillsMode = searchParams.get("skillsMode") === "all" ? "all" : "any";
  const teamId = searchParams.get("team")?.trim() ?? "";

  const baseParams = new URLSearchParams();
  if (filter && filter !== "active") baseParams.set("filter", filter);
  if (lowMargin) baseParams.set("lowMargin", "1");
  if (skillsFilter.length) baseParams.set("skills", skillsFilter.join(","));
  if (statusFilter.length) baseParams.set("status", statusFilter.join(","));
  if (riskFilter.length) baseParams.set("risk", riskFilter.join(","));
  if (deadlineAfter) baseParams.set("deadlineAfter", deadlineAfter);
  if (deadlineBefore) baseParams.set("deadlineBefore", deadlineBefore);
  if (skillsMode === "all") baseParams.set("skillsMode", "all");
  if (teamId) baseParams.set("team", teamId);

  const viewSnapshot: AdminOrderListViewSnapshot = {
    filter: filter === "active" ? "active" : filter === "done" ? "done" : "all",
    lowMargin,
    skillsFilter,
    statusFilter,
    riskFilter,
    deadlineAfter,
    deadlineBefore,
    skillsMode,
    teamId,
  };

  try {
    const accessWhere = await getOrderAccessWhereInput(admin.id);

    const statusFilterWhere: Prisma.OrderWhereInput =
      filter === "active"
        ? { status: { not: "DONE" } }
        : filter === "done"
          ? { status: "DONE" }
          : {};

    const teamWhere: Prisma.OrderWhereInput = teamId ? { teamId } : {};

    const where: Prisma.OrderWhereInput = {
      AND: [accessWhere, statusFilterWhere, teamWhere],
    };

    const orgIds = await getAccessibleOrganizationIds(admin.id);

    const [executorsForSkills, templates, teams, ordersRaw] = await Promise.all([
      prisma.user.findMany({
        where: { role: "executor", status: "active" },
        select: { skills: true },
      }),
      prisma.orderTemplate.findMany({
        orderBy: { title: "asc" },
        select: { id: true, title: true },
      }),
      orgIds.length
        ? prisma.team.findMany({
            where: { organizationId: { in: orgIds } },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      prisma.order.findMany({
        where,
        include: {
          executor: true,
          checkpoints: true,
          files: true,
          orderExecutors: { select: { userId: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

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

    return NextResponse.json({
      orders: serializeOrdersForListClient(orders),
      allSkills,
      templates,
      teams,
      viewSnapshot,
      sort,
      baseUrlParams: baseParams.toString(),
      degraded: false as const,
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[GET /api/admin/orders-list]", e);
    }
    return NextResponse.json({
      orders: [],
      allSkills: [],
      templates: [],
      teams: [],
      viewSnapshot,
      sort,
      baseUrlParams: baseParams.toString(),
      degraded: true as const,
      degradedMessage: dbUnavailableUserMessage(e),
    });
  }
}
