import prisma from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { leadIsActive, orderIsActive } from "@/lib/active-scope";
import { hardDeleteOrderById } from "@/lib/delete-order";
import { recalculateFinance } from "@/lib/recalculate-finance";

export async function softDeleteOrder(
  orderId: string,
  changedById: string,
  options?: { actionType?: string },
) {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
  });
  if (!existing) {
    const err = new Error("NOT_FOUND") as Error & { code?: string };
    err.code = "NOT_FOUND";
    throw err;
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    entityType: "order",
    entityId: orderId,
    actionType: options?.actionType ?? "delete_order",
    changedById,
    diff: {
      soft: true,
      hard: false,
      entity: "order",
      id: orderId,
    },
  });
  await recalculateFinance();
}

export async function hardDeleteOrder(
  orderId: string,
  changedById: string,
  options?: { actionType?: string },
) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) {
    const err = new Error("NOT_FOUND") as Error & { code?: string };
    err.code = "NOT_FOUND";
    throw err;
  }
  await hardDeleteOrderById(orderId);
  await writeAudit({
    entityType: "order",
    entityId: orderId,
    actionType: options?.actionType ?? "delete_order_hard",
    changedById,
    diff: {
      soft: false,
      hard: true,
      entity: "order",
      id: orderId,
      hadSoftDelete: Boolean(existing.deletedAt),
    },
  });
  await recalculateFinance();
}

export async function softDeleteLead(leadId: string, changedById: string) {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, ...leadIsActive },
  });
  if (!existing) {
    const err = new Error("NOT_FOUND") as Error & { code?: string };
    err.code = "NOT_FOUND";
    throw err;
  }
  const linked = await prisma.order.count({
    where: { leadId, ...orderIsActive },
  });
  if (linked > 0) {
    const err = new Error("LEAD_HAS_ORDERS") as Error & { code?: string };
    err.code = "LEAD_HAS_ORDERS";
    throw err;
  }
  await prisma.lead.update({
    where: { id: leadId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    entityType: "lead",
    entityId: leadId,
    actionType: "delete_lead",
    changedById,
    diff: { soft: true, hard: false, entity: "lead", id: leadId },
  });
}

export async function hardDeleteLead(leadId: string, changedById: string) {
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) {
    const err = new Error("NOT_FOUND") as Error & { code?: string };
    err.code = "NOT_FOUND";
    throw err;
  }
  await prisma.$transaction([
    prisma.order.updateMany({
      where: { leadId },
      data: { leadId: null },
    }),
    prisma.lead.delete({ where: { id: leadId } }),
  ]);
  await writeAudit({
    entityType: "lead",
    entityId: leadId,
    actionType: "delete_lead_hard",
    changedById,
    diff: { soft: false, hard: true, entity: "lead", id: leadId },
  });
}
