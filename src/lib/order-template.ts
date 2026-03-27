import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

const checkpointItemSchema = z.object({
  title: z.string().min(1),
  due_offset_days: z.union([z.number(), z.null()]).optional(),
});

const templateCheckpointsSchema = z.array(checkpointItemSchema);

export type TemplateCheckpointItem = z.infer<typeof checkpointItemSchema>;

export function parseDefaultCheckpoints(json: unknown): TemplateCheckpointItem[] {
  const parsed = templateCheckpointsSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data;
}

export function buildDescriptionFromTemplate(
  descriptionTemplate: string,
  userText: string,
): string {
  const base = descriptionTemplate.trim();
  const text = userText.trim();
  if (!text) return base || "—";
  if (!base) return text;
  return `${base}\n\n${text}`;
}

/** Первая строка — заголовок, остальное — ТЗ. Одна строка: заголовок и ТЗ совпадают. */
export function parseOrderTextBlock(text: string): { title: string; description: string } {
  const t = text.trim();
  if (!t) return { title: "Без названия", description: "—" };
  const nl = t.indexOf("\n");
  if (nl === -1) {
    const title = t.slice(0, 200);
    return { title, description: t };
  }
  const title = t.slice(0, nl).trim().slice(0, 200) || "Без названия";
  const description = t.slice(nl + 1).trim() || "—";
  return { title, description };
}

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function createCheckpointsFromTemplate(
  tx: Tx,
  orderId: string,
  orderCreatedAt: Date,
  defaultCheckpoints: unknown,
): Promise<void> {
  const items = parseDefaultCheckpoints(defaultCheckpoints);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let dueDate: Date | null = null;
    const off = item.due_offset_days;
    if (typeof off === "number" && Number.isFinite(off)) {
      dueDate = new Date(orderCreatedAt.getTime() + off * 86_400_000);
    }
    await tx.checkpoint.create({
      data: {
        orderId,
        title: item.title,
        status: "pending",
        dueDate,
        position: i,
      },
    });
  }
}
