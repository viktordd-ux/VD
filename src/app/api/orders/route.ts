import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { computeProfit } from "@/lib/money";
import { assertUsersAreOrgExecutors, replaceOrderExecutors } from "@/lib/order-executors";
import {
  getOrderAccessWhereInput,
  getSerializeOrderRoleForUser,
  userHasExtendedOrderListView,
} from "@/lib/order-access";
import { serializeOrder } from "@/lib/serialize";
import {
  buildDescriptionFromTemplate,
  createCheckpointsFromTemplate,
} from "@/lib/order-template";
import { getPrimaryOrganizationIdForUser } from "@/lib/org-scope";
import { resolveTeamIdForOrder } from "@/lib/team-scope";
import { revalidateOrderViews } from "@/lib/revalidate-app";
import { pushNotifyExecutorAssigned } from "@/lib/push-notify";
import { notifyExecutorOrderAssigned } from "@/lib/telegram-notify";

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const extended = await userHasExtendedOrderListView(user.id);

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const lowMargin = searchParams.get("lowMargin");

  const statusWhere =
    filter === "active"
      ? { status: { not: "DONE" as const } }
      : filter === "done"
        ? { status: "DONE" as const }
        : {};

  let orders = await prisma.order.findMany({
    where: { ...accessWhere, ...statusWhere },
    include: {
      executor: true,
      orderExecutors: { select: { userId: true } },
      ...(extended ? { lead: true } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  if (extended && lowMargin === "1") {
    orders = orders.filter((o) => {
      const bc = Number(o.budgetClient);
      if (bc <= 0) return false;
      return Number(o.profit) / bc < 0.5;
    });
  }

  const payload = await Promise.all(
    orders.map(async (o) => {
      const role = await getSerializeOrderRoleForUser(user.id, o.organizationId);
      return serializeOrder(o, role);
    }),
  );
  return NextResponse.json(payload);
}

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
    title?: string;
    description?: string;
    clientName?: string;
    platform?: string;
    deadline?: string | null;
    budgetClient?: number | string;
    budgetExecutor?: number | string;
    status?: string;
    executorId?: string | null;
    templateId?: string | null;
    requiredSkills?: string[];
    teamId?: string | null;
  };

  const template = body.templateId
    ? await prisma.orderTemplate.findUnique({ where: { id: body.templateId } })
    : null;
  if (body.templateId && !template) {
    return NextResponse.json({ error: "Шаблон не найден" }, { status: 400 });
  }

  if (!body.title || !body.description || !body.clientName || !body.platform) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const title = body.title;
  const clientName = body.clientName;
  const platform = body.platform;
  const plainDescription = body.description;

  const description = template
    ? buildDescriptionFromTemplate(template.descriptionTemplate, plainDescription)
    : plainDescription;

  const budgetClient = Number(body.budgetClient ?? 0);
  const budgetExecutor = Number(body.budgetExecutor ?? 0);
  const profit = computeProfit(budgetClient, budgetExecutor);

  const requiredSkills =
    body.requiredSkills !== undefined ? body.requiredSkills : (template?.tags ?? []);

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

  if (body.executorId) {
    try {
      await assertUsersAreOrgExecutors(organizationId, [body.executorId]);
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
        title,
        description,
        clientName,
        platform,
        deadline: body.deadline ? new Date(body.deadline) : null,
        budgetClient,
        budgetExecutor,
        profit,
        status: (body.status as "LEAD" | "IN_PROGRESS" | "REVIEW" | "DONE") ?? "LEAD",
        executorId: body.executorId ?? null,
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
    diff: { after: order },
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
