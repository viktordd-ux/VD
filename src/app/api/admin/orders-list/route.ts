import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { getOrderAccessWhereInput } from "@/lib/order-access";
import { getAccessibleOrganizationIds } from "@/lib/org-scope";
import { dbUnavailableUserMessage } from "@/lib/db-unavailable-message";
import type { OrderWithRelations } from "@/lib/order-list-filters";
import { serializeOrdersForListClient } from "@/lib/order-list-client-serialize";
import type { AdminOrdersCatalogPayload } from "@/lib/admin-orders-list-derive";

/**
 * Полный каталог заказов по правам доступа (без фильтров вкладок/команд/навыков).
 * Фильтрация и сортировка для UI — на клиенте (useMemo), переключение мгновенное.
 */
export async function GET() {
  const admin = await requireUser();
  if (admin instanceof NextResponse) return admin;

  try {
    const accessWhere = await getOrderAccessWhereInput(admin.id);
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
        where: accessWhere,
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

    const orders = ordersRaw as OrderWithRelations[];

    const payload: AdminOrdersCatalogPayload = {
      orders: serializeOrdersForListClient(orders),
      allSkills,
      templates,
      teams,
      degraded: false as const,
    };

    return NextResponse.json(payload);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[GET /api/admin/orders-list]", e);
    }
    const empty: AdminOrdersCatalogPayload = {
      orders: [],
      allSkills: [],
      templates: [],
      teams: [],
      degraded: true as const,
      degradedMessage: dbUnavailableUserMessage(e),
    };
    return NextResponse.json(empty);
  }
}
