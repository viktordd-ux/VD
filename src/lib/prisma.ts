import { PrismaClient } from "@prisma/client";

/**
 * На Vercel (serverless) нельзя создавать новый PrismaClient на каждый запрос —
 * иначе исчерпывается пул Supabase (MaxClientsInSessionMode / too many connections).
 * Кэшируем на globalThis и в production.
 *
 * P2024 (pool timeout): при connection_limit=1 не запускайте много prisma-запросов в
 * Promise.all — сериализуйте await. В DATABASE_URL для pooler можно добавить
 * pool_timeout=20 (сек.) при необходимости.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export default prisma;
