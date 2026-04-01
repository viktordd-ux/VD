import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { leadIsActive } from "@/lib/active-scope";
import { getPrimaryOrganizationIdForUser } from "@/lib/org-scope";
import { resolveTeamIdForOrder } from "@/lib/team-scope";
import { computeProfit } from "@/lib/money";
import { revalidateAdminLeads, revalidateOrderViews } from "@/lib/revalidate-app";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await requireStaff();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const lead = await prisma.lead.findFirst({ where: { id, ...leadIsActive } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const organizationId = await getPrimaryOrganizationIdForUser(user.id);
  if (!organizationId) {
    return NextResponse.json(
      { error: "Нет организации: создайте организацию или примите приглашение" },
      { status: 400 },
    );
  }

  let body: { teamId?: string } = {};
  try {
    body = (await req.json()) as { teamId?: string };
  } catch {
    /* тело необязательно */
  }

  let teamId: string | null = null;
  if (body.teamId != null && String(body.teamId).trim()) {
    const resolved = await resolveTeamIdForOrder(organizationId, body.teamId);
    if (!resolved) {
      return NextResponse.json(
        { error: "Команда не найдена в этой организации" },
        { status: 400 },
      );
    }
    teamId = resolved;
  }

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
      organizationId,
      teamId,
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

  revalidateOrderViews(order.id);
  revalidateAdminLeads();
  return NextResponse.json({ order, lead: leadUpdated });
}
