import type { Order, User, Checkpoint, File } from "@prisma/client";
import type { OrderRiskFlags } from "@/lib/order-risk";
import { getOrderRiskFlags } from "@/lib/order-risk";

export type OrderListSort =
  | "updated_desc"
  | "deadline_asc"
  | "deadline_desc"
  | "profit_asc"
  | "profit_desc"
  | "margin_asc"
  | "margin_desc";

export type OrderWithRelations = Order & {
  executor: User | null;
  checkpoints: Checkpoint[];
  files: File[];
};

export function marginRatio(order: Order): number {
  const bc = Number(order.budgetClient);
  if (bc <= 0) return 0;
  return Number(order.profit) / bc;
}

export function parseCsv(param: string | undefined): string[] {
  if (!param?.trim()) return [];
  return param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function computeFlags(o: OrderWithRelations): OrderRiskFlags {
  return getOrderRiskFlags(o, o.checkpoints, o.files);
}

/** Хотя бы один из выбранных рисков (если список пуст — без фильтра по рискам). */
export function matchesRiskFilters(
  flags: OrderRiskFlags,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  return selected.some((k) => {
    if (k === "revision") return flags.redRevisions;
    if (k === "deadline") return flags.redDeadline;
    if (k === "checkpoint") return flags.yellowCheckpoint;
    if (k === "silent_warn") return flags.yellowSilent;
    if (k === "silent_high") return flags.redSilent;
    return false;
  });
}

export function isLowMargin(order: Order): boolean {
  const bc = Number(order.budgetClient);
  if (bc <= 0) return false;
  return Number(order.profit) / bc < 0.5;
}

/** Исполнитель: any — хотя бы один навык; all — все выбранные. */
export function matchesSkills(
  executor: User | null,
  selectedSkills: string[],
  mode: "any" | "all" = "any",
): boolean {
  if (selectedSkills.length === 0) return true;
  if (!executor?.skills?.length) return false;
  const set = new Set(executor.skills.map((s) => s.toLowerCase()));
  const sel = selectedSkills.map((s) => s.toLowerCase());
  if (mode === "all") return sel.every((s) => set.has(s));
  return sel.some((s) => set.has(s));
}

export function matchesStatus(
  order: Order,
  selectedStatuses: string[],
): boolean {
  if (selectedStatuses.length === 0) return true;
  return selectedStatuses.includes(order.status);
}

/** Фильтр по дедлайну заказа: date строки YYYY-MM-DD (границы включительно). */
export function matchesDeadlineRange(
  order: Order,
  after?: string,
  before?: string,
): boolean {
  if (!after?.trim() && !before?.trim()) return true;
  if (!order.deadline) return false;
  const t = order.deadline.getTime();
  if (after?.trim()) {
    const a = new Date(`${after.trim()}T00:00:00.000Z`).getTime();
    if (t < a) return false;
  }
  if (before?.trim()) {
    const b = new Date(`${before.trim()}T23:59:59.999Z`).getTime();
    if (t > b) return false;
  }
  return true;
}

export function sortOrders(
  orders: OrderWithRelations[],
  sort: OrderListSort,
): OrderWithRelations[] {
  const copy = [...orders];
  copy.sort((a, b) => {
    switch (sort) {
      case "deadline_asc": {
        const ta = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
        const tb = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
        return ta - tb;
      }
      case "deadline_desc": {
        const ta = a.deadline?.getTime() ?? Number.NEGATIVE_INFINITY;
        const tb = b.deadline?.getTime() ?? Number.NEGATIVE_INFINITY;
        return tb - ta;
      }
      case "profit_asc":
        return Number(a.profit) - Number(b.profit);
      case "profit_desc":
        return Number(b.profit) - Number(a.profit);
      case "margin_asc":
        return marginRatio(a) - marginRatio(b);
      case "margin_desc":
        return marginRatio(b) - marginRatio(a);
      case "updated_desc":
      default:
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
  });
  return copy;
}

/** Снимок фильтров страницы /admin/orders (для realtime — те же правила, что на сервере). */
export type AdminOrderListViewSnapshot = {
  filter: "active" | "done" | "all";
  lowMargin: boolean;
  skillsFilter: string[];
  statusFilter: string[];
  riskFilter: string[];
  deadlineAfter: string;
  deadlineBefore: string;
  skillsMode: "any" | "all";
};

export function matchesAdminOrderListView(
  o: OrderWithRelations,
  s: AdminOrderListViewSnapshot,
): boolean {
  if (o.deletedAt) return false;
  if (s.filter === "active" && o.status === "DONE") return false;
  if (s.filter === "done" && o.status !== "DONE") return false;
  if (s.lowMargin && !isLowMargin(o)) return false;
  if (s.skillsFilter.length && !matchesSkills(o.executor, s.skillsFilter, s.skillsMode)) {
    return false;
  }
  if (s.statusFilter.length && !matchesStatus(o, s.statusFilter)) return false;
  if (s.riskFilter.length) {
    const flags = computeFlags(o);
    if (!matchesRiskFilters(flags, s.riskFilter)) return false;
  }
  if (!matchesDeadlineRange(o, s.deadlineAfter, s.deadlineBefore)) return false;
  return true;
}

/** Главная исполнителя: только незавершённые задачи. */
export function matchesExecutorHomeOrder(o: OrderWithRelations): boolean {
  return o.status !== "DONE";
}
