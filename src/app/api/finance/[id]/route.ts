import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { hardDeleteOrder, softDeleteOrder } from "@/lib/deletion-ops";
import { computeProfit } from "@/lib/money";
import { recalculateFinance } from "@/lib/recalculate-finance";
import { orderIsActive } from "@/lib/active-scope";
import { revalidateAdminFinance, revalidateOrderViews } from "@/lib/revalidate-app";

type Params = { params: Promise<{ id: string }> };

/** id заказа — финансовая строка в системе = Order (budget, profit). */
export async function DELETE(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  try {
    if (hard) {
      await hardDeleteOrder(id, admin.id, { actionType: "delete_finance" });
    } else {
      await softDeleteOrder(id, admin.id, { actionType: "delete_finance" });
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }

  revalidateOrderViews(id);
  revalidateAdminFinance();
  return NextResponse.json({ ok: true, hard });
}

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.order.findFirst({
    where: { id, ...orderIsActive },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<{
    budgetClient: number | string;
    budgetExecutor: number | string;
    note: string;
  }>;

  const budgetClient =
    body.budgetClient !== undefined
      ? Number(body.budgetClient)
      : Number(existing.budgetClient);
  const budgetExecutor =
    body.budgetExecutor !== undefined
      ? Number(body.budgetExecutor)
      : Number(existing.budgetExecutor);
  const profit = computeProfit(budgetClient, budgetExecutor);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      budgetClient: body.budgetClient !== undefined ? budgetClient : undefined,
      budgetExecutor: body.budgetExecutor !== undefined ? budgetExecutor : undefined,
      profit:
        body.budgetClient !== undefined || body.budgetExecutor !== undefined
          ? profit
          : undefined,
    },
  });

  await writeAudit({
    entityType: "order",
    entityId: id,
    actionType: "finance_adjust",
    changedById: admin.id,
    diff: {
      before: {
        budgetClient: existing.budgetClient.toString(),
        budgetExecutor: existing.budgetExecutor.toString(),
        profit: existing.profit.toString(),
      },
      after: {
        budgetClient: updated.budgetClient.toString(),
        budgetExecutor: updated.budgetExecutor.toString(),
        profit: updated.profit.toString(),
      },
      note: body.note ?? null,
    },
  });

  await recalculateFinance();

  revalidateOrderViews(id);
  revalidateAdminFinance();
  return NextResponse.json({
    id: updated.id,
    budgetClient: updated.budgetClient.toString(),
    budgetExecutor: updated.budgetExecutor.toString(),
    profit: updated.profit.toString(),
  });
}
