import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { computeProfit } from "@/lib/money";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const budgetClient = 0;
  const budgetExecutor = 0;
  const profit = computeProfit(budgetClient, budgetExecutor);

  const order = await prisma.order.create({
    data: {
      title: `Заказ: ${lead.clientName}`,
      description: lead.text,
      clientName: lead.clientName,
      platform: lead.platform,
      deadline: null,
      budgetClient,
      budgetExecutor,
      profit,
      status: "LEAD",
      leadId: lead.id,
    },
  });

  const leadUpdated = await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "WON" },
  });

  await writeAudit({
    entityType: "order",
    entityId: order.id,
    actionType: "create_from_lead",
    changedById: user.id,
    diff: { leadId: lead.id, order },
  });

  await writeAudit({
    entityType: "lead",
    entityId: lead.id,
    actionType: "convert_to_order",
    changedById: user.id,
    diff: { orderId: order.id, lead: leadUpdated },
  });

  return NextResponse.json({ order, lead: leadUpdated });
}
