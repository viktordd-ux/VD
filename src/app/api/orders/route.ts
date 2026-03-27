import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { computeProfit } from "@/lib/money";
import { serializeOrder } from "@/lib/serialize";
import {
  buildDescriptionFromTemplate,
  createCheckpointsFromTemplate,
} from "@/lib/order-template";
import { orderIsActive } from "@/lib/active-scope";

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const lowMargin = searchParams.get("lowMargin");

  const where =
    user.role === "executor"
      ? { executorId: user.id }
      : {};

  const statusWhere =
    filter === "active"
      ? { status: { not: "DONE" as const } }
      : filter === "done"
        ? { status: "DONE" as const }
        : {};

  let orders = await prisma.order.findMany({
    where: { ...where, ...statusWhere, ...orderIsActive },
    include: {
      executor: true,
      ...(user.role === "admin" ? { lead: true } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  if (user.role === "admin" && lowMargin === "1") {
    orders = orders.filter((o) => {
      const bc = Number(o.budgetClient);
      if (bc <= 0) return false;
      return Number(o.profit) / bc < 0.5;
    });
  }

  const payload = orders.map((o) =>
    serializeOrder(o, user.role === "admin" ? "admin" : "executor"),
  );
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

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

  return NextResponse.json(serializeOrder(order, "admin"));
}
