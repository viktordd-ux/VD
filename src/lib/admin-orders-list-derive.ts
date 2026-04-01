import type { AdminOrdersListQueryPayload } from "@/lib/react-query-realtime";
import type { SerializedOrderWithRelations } from "@/lib/order-list-client-serialize";
import type {
  AdminOrderListViewSnapshot,
  OrderListSort,
} from "@/lib/order-list-filters";
import { parseCsv } from "@/lib/order-list-filters";

/** Ответ GET /api/admin/orders-list (без производных полей из URL). */
export type AdminOrdersCatalogPayload = {
  orders: SerializedOrderWithRelations[];
  allSkills: string[];
  templates: { id: string; title: string }[];
  teams: { id: string; name: string }[];
  degraded?: boolean;
  degradedMessage?: string;
};

/** Парсинг URL → снимок фильтров (как на сервере раньше). */
export function parseViewSnapshotFromSearchParamsString(
  searchParamsString: string,
): {
  viewSnapshot: AdminOrderListViewSnapshot;
  sort: OrderListSort;
  baseUrlParams: string;
} {
  const searchParams = new URLSearchParams(
    searchParamsString.startsWith("?")
      ? searchParamsString.slice(1)
      : searchParamsString,
  );
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
    filter:
      filter === "active" ? "active" : filter === "done" ? "done" : "all",
    lowMargin,
    skillsFilter,
    statusFilter,
    riskFilter,
    deadlineAfter,
    deadlineBefore,
    skillsMode,
    teamId,
  };

  return {
    viewSnapshot,
    sort,
    baseUrlParams: baseParams.toString(),
  };
}

export function mergeCatalogWithView(
  catalog: AdminOrdersCatalogPayload,
  searchParamsString: string,
): AdminOrdersListQueryPayload {
  const { viewSnapshot, sort, baseUrlParams } =
    parseViewSnapshotFromSearchParamsString(searchParamsString);
  return {
    ...catalog,
    viewSnapshot,
    sort,
    baseUrlParams,
  } satisfies AdminOrdersListQueryPayload;
}
