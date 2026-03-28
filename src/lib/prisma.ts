import { PrismaClient } from "@prisma/client";

/**
 * На Vercel (serverless) нельзя создавать новый PrismaClient на каждый запрос —
 * иначе исчерпывается пул Supabase (MaxClientsInSessionMode / too many connections).
 * Кэшируем на globalThis и в production.
 *
 * P2024: при connection_limit=1 не используйте Promise.all с кучей prisma-запросов.
 * Плюс поднимаем pool_timeout (по умолчанию у Prisma 10 с), если в URL не задано.
 */
function prismaDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("pool_timeout")) {
      u.searchParams.set("pool_timeout", "60");
    }
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "30");
    }
    return u.toString();
  } catch {
    const sep = raw.includes("?") ? "&" : "?";
    if (/[?&]pool_timeout=/.test(raw)) return raw;
    return `${raw}${sep}pool_timeout=60&connect_timeout=30`;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: prismaDatabaseUrl() ?? process.env.DATABASE_URL,
      },
    },
    /** По умолчанию maxWait 2 с — мало для Vercel + Supabase при очереди к пулу. */
    transactionOptions: {
      maxWait: 30_000,
      timeout: 120_000,
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export default prisma;
