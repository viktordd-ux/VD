import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { getBestExecutor } from "@/lib/executor-matching";
import { computeProfit } from "@/lib/money";
import { assertUsersAreOrgExecutors, replaceOrderExecutors } from "@/lib/order-executors";
import { serializeOrder } from "@/lib/serialize";
import {
  buildDescriptionFromTemplate,
  createCheckpointsFromTemplate,
  parseOrderTextBlock,
} from "@/lib/order-template";
import { getPrimaryOrganizationIdForUser } from "@/lib/org-scope";
import { resolveTeamIdForOrder } from "@/lib/team-scope";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import { pushNotifyExecutorAssigned } from "@/lib/push-notify";
import { notifyExecutorOrderAssigned } from "@/lib/telegram-notify";

export async function POST(req: Request) {
  const user = await requireStaff();
  if (user instanceof NextResponse) return user;

  const organizationId = await getPrimaryOrganizationIdForUser(user.id);
  if (!organizationId) {
    return NextResponse.json(
      { error: "Нет организации: создайте организацию или примите приглашение" },
      { status: 400 },
    );
  }

  const body = (await req.json()) as {
    orderText?: string;
    templateId?: string | null;
    autoAssign?: boolean;
    clientName?: string;
    platform?: string;
    budgetClient?: number | string;
    budgetExecutor?: number | string;
    status?: string;
    executorId?: string | null;
    teamId?: string | null;
  };

  const orderText = body.orderText?.trim() ?? "";
  if (!orderText) {
    return NextResponse.json({ error: "Введите текст заказа" }, { status: 400 });
  }

  const template = body.templateId
    ? await prisma.orderTemplate.findUnique({ where: { id: body.templateId } })
    : null;
  if (body.templateId && !template) {
    return NextResponse.json({ error: "Шаблон не найден" }, { status: 400 });
  }

  const parsed = parseOrderTextBlock(orderText);
  const description = template
    ? buildDescriptionFromTemplate(template.descriptionTemplate, parsed.description)
    : parsed.description;

  const budgetClient = Number(body.budgetClient ?? 0);
  const budgetExecutor = Number(body.budgetExecutor ?? 0);
  const profit = computeProfit(budgetClient, budgetExecutor);

  const requiredSkills = template?.tags ?? [];

  let executorId: string | null = body.executorId ?? null;
  if (body.autoAssign) {
    const best = await getBestExecutor({ requiredSkills, organizationId });
    if (best) executorId = best.id;
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

  if (executorId) {
    try {
      await assertUsersAreOrgExecutors(organizationId, [executorId]);
    } catch {
      return NextResponse.json(
        { error: "Недопустимый исполнитель для организации" },
        { status: 400 },
      );
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        title: parsed.title,
        description,
        clientName: body.clientName?.trim() || "Быстрый заказ",
        platform: body.platform?.trim() || "—",
        deadline: null,
        budgetClient,
        budgetExecutor,
        profit,
        status: (body.status as "LEAD" | "IN_PROGRESS" | "REVIEW" | "DONE") ?? "IN_PROGRESS",
        executorId,
        templateId: template?.id ?? null,
        requiredSkills,
        organizationId,
        teamId,
      },
      include: { executor: true },
    });

    if (template) {
      await createCheckpointsFromTemplate(
        tx,
        o.id,
        o.createdAt,
        template.defaultCheckpoints,
      );
    }

    return o;
  });

  await writeAudit({
    entityType: "order",
    entityId: order.id,
    actionType: "create",
    changedById: user.id,
    diff: { after: order, quick: true },
  });

  if (order.executorId) {
    await replaceOrderExecutors(order.id, [order.executorId]);
    notifyExecutorOrderAssigned(order.executorId, order.title);
    pushNotifyExecutorAssigned(order.executorId, order.title, order.id);
  }

  revalidateOrderViews(order.id);
  const created = await prisma.order.findFirst({
    where: { id: order.id },
    include: { executor: true, lead: true, orderExecutors: { select: { userId: true } } },
  });
  return NextResponse.json(serializeOrder(created ?? order, "admin"));
}
