import { PrismaClient } from "@prisma/client";

/**
 * На Vercel (serverless) нельзя создавать новый PrismaClient на каждый запрос —
 * иначе исчерпывается пул Supabase (MaxClientsInSessionMode / too many connections).
 * Кэшируем на globalThis и в production.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export default prisma;
