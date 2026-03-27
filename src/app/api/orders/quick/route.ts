import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { getBestExecutor } from "@/lib/executor-matching";
import { computeProfit } from "@/lib/money";
import { serializeOrder } from "@/lib/serialize";
import {
  buildDescriptionFromTemplate,
  createCheckpointsFromTemplate,
  parseOrderTextBlock,
} from "@/lib/order-template";

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

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
    const best = await getBestExecutor({ requiredSkills });
    if (best) executorId = best.id;
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

  return NextResponse.json(serializeOrder(order, "admin"));
}
