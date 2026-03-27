import type { Prisma } from "@prisma/client";

/** Активные заказы (не удалённые soft/hard логикой UI). */
export const orderIsActive: Prisma.OrderWhereInput = { deletedAt: null };

/** Активные лиды. */
export const leadIsActive: Prisma.LeadWhereInput = { deletedAt: null };
